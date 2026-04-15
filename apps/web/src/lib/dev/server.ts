import { execFile, spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { createServerFn } from "@tanstack/react-start"

import type {
  CreatedPullRequest,
  LocalProjectRepoInfo,
  ProjectLinkSettings,
} from "@/lib/monday/types"

const execFileAsync = promisify(execFile)

function getWorkspacePath() {
  return process.cwd()
}

function getProjectPath(project?: ProjectLinkSettings) {
  const value = project?.path?.trim()

  if (!value) {
    return getWorkspacePath()
  }

  return path.resolve(value)
}

async function runCommand(
  command: string,
  args: Array<string>,
  cwd: string
) {
  const result = await execFileAsync(command, args, {
    cwd,
    windowsHide: true,
  })

  return result.stdout.trim()
}

async function getGitOutput(args: Array<string>, cwd: string) {
  return runCommand("git", args, cwd)
}

async function getGhOutput(args: Array<string>, cwd: string) {
  return runCommand("gh", args, cwd)
}

function openPathInFileExplorer(targetPath: string) {
  if (process.platform === "win32") {
    const child = spawn("explorer.exe", [targetPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    })
    child.unref()
    return
  }

  if (process.platform === "darwin") {
    const child = spawn("open", [targetPath], {
      detached: true,
      stdio: "ignore",
    })
    child.unref()
    return
  }

  const child = spawn("xdg-open", [targetPath], {
    detached: true,
    stdio: "ignore",
  })
  child.unref()
}

function parseRemoteSlug(remoteUrl?: string) {
  if (!remoteUrl) {
    return undefined
  }

  const normalizedUrl = remoteUrl.trim()
  const httpsMatch = normalizedUrl.match(
    /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/i
  )

  if (httpsMatch?.[1]) {
    return httpsMatch[1]
  }

  return undefined
}

async function resolveDefaultBranch(cwd: string) {
  try {
    const remoteHead = await getGitOutput(
      ["symbolic-ref", "refs/remotes/origin/HEAD"],
      cwd
    )

    return remoteHead.split("/").at(-1)
  } catch {
    return undefined
  }
}

async function getRepoInfo(project?: ProjectLinkSettings) {
  const requestedPath = getProjectPath(project)

  if (!existsSync(requestedPath)) {
    throw new Error("That project path does not exist.")
  }

  const topLevelPath = await getGitOutput(
    ["rev-parse", "--show-toplevel"],
    requestedPath
  )
  const branchesOutput = await getGitOutput(
    ["for-each-ref", "--format=%(refname:short)", "refs/heads"],
    topLevelPath
  )
  const remoteUrl = await getGitOutput(["remote", "get-url", "origin"], topLevelPath)
  const currentBranch = await getGitOutput(
    ["branch", "--show-current"],
    topLevelPath
  )
  const defaultBranch = await resolveDefaultBranch(topLevelPath)

  return {
    branches: branchesOutput.split(/\r?\n/).filter(Boolean).sort(),
    currentBranch: currentBranch || undefined,
    defaultBranch: defaultBranch || undefined,
    path: requestedPath,
    remoteName: remoteUrl || undefined,
    repoSlug: parseRemoteSlug(remoteUrl),
    topLevelPath,
  } satisfies LocalProjectRepoInfo
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function fillTemplate(
  template: string,
  values: Record<string, string | undefined>
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return values[key] || ""
  })
}

function getSummary(summary: {
  ticketDescription?: string
  ticketSummary?: string
}) {
  return [summary.ticketSummary, summary.ticketDescription]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n\n")
}

export const getLocalProjectRepo = createServerFn({ method: "POST" })
  .inputValidator((data: { project?: ProjectLinkSettings }) => data)
  .handler(async ({ data }): Promise<LocalProjectRepoInfo> => {
    return getRepoInfo(data.project)
  })

export const openLocalProjectPath = createServerFn({ method: "POST" })
  .inputValidator((data: { project?: ProjectLinkSettings }) => data)
  .handler(async ({ data }) => {
    const repo = await getRepoInfo(data.project)
    openPathInFileExplorer(repo.topLevelPath)

    return { ok: true, path: repo.topLevelPath }
  })

export const createTicketBranch = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      baseBranch: string
      branchName: string
      project?: ProjectLinkSettings
    }) => data
  )
  .handler(async ({ data }) => {
    const repo = await getRepoInfo(data.project)
    const branchName = data.branchName.trim()
    const baseBranch = data.baseBranch.trim()

    if (!branchName) {
      throw new Error("Enter a branch name first.")
    }

    await getGitOutput(["fetch", "origin"], repo.topLevelPath)
    await getGitOutput(["switch", baseBranch], repo.topLevelPath)

    try {
      await getGitOutput(
        ["rev-parse", "--verify", `refs/heads/${branchName}`],
        repo.topLevelPath
      )
      await getGitOutput(["switch", branchName], repo.topLevelPath)
    } catch {
      await getGitOutput(
        ["switch", "-c", branchName, `origin/${baseBranch}`],
        repo.topLevelPath
      )
    }

    return {
      branchName,
      ok: true,
      path: repo.topLevelPath,
    }
  })

export const checkoutProjectBranch = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      branchName: string
      project?: ProjectLinkSettings
    }) => data
  )
  .handler(async ({ data }) => {
    const repo = await getRepoInfo(data.project)
    const branchName = data.branchName.trim()

    if (!branchName) {
      throw new Error("Choose a branch first.")
    }

    await getGitOutput(["switch", branchName], repo.topLevelPath)

    return {
      branchName,
      ok: true,
      path: repo.topLevelPath,
    }
  })

export const generatePullRequestDraft = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      baseBranch: string
      branchName: string
      project?: ProjectLinkSettings
      ticketDescription?: string
      ticketId: string
      ticketSummary?: string
      ticketTitle: string
      ticketUrl?: string
    }) => data
  )
  .handler(({ data }) => {
    const branchName = data.branchName.trim()
    const baseBranch = data.baseBranch.trim()
    const branchTemplate =
      data.project?.branchTemplate || "ticket/{{ticketId}}-{{slug}}"
    const prTitleTemplate =
      data.project?.prTitleTemplate || "[{{ticketId}}] {{ticketTitle}}"
    const prBodyTemplate =
      data.project?.prBodyTemplate ||
      [
        "## Summary",
        "{{summary}}",
        "",
        "## Monday",
        "- Ticket: {{ticketUrl}}",
      ].join("\n")

    const summary = getSummary({
      ticketDescription: data.ticketDescription,
      ticketSummary: data.ticketSummary || data.ticketTitle,
    })
    const slug = slugify(data.ticketTitle || data.ticketId)
    const values = {
      baseBranch,
      branchName,
      generatedBranchName: fillTemplate(branchTemplate, {
        slug,
        ticketId: data.ticketId,
        ticketTitle: data.ticketTitle,
      }),
      slug,
      summary,
      ticketId: data.ticketId,
      ticketTitle: data.ticketTitle,
      ticketUrl: data.ticketUrl,
    }

    return {
      body: fillTemplate(prBodyTemplate, values).trim(),
      title: fillTemplate(prTitleTemplate, values).trim(),
    }
  })

export const createGithubPullRequest = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      baseBranch: string
      body: string
      branchName: string
      draft?: boolean
      project?: ProjectLinkSettings
      title: string
    }) => data
  )
  .handler(async ({ data }): Promise<CreatedPullRequest> => {
    const repo = await getRepoInfo(data.project)

    await getGitOutput(["push", "-u", "origin", data.branchName], repo.topLevelPath)

    const args = [
      "pr",
      "create",
      "--repo",
      repo.repoSlug || "",
      "--base",
      data.baseBranch,
      "--head",
      data.branchName,
      "--title",
      data.title,
      "--body",
      data.body,
    ]

    if (data.draft) {
      args.push("--draft")
    }

    const url = await getGhOutput(args.filter(Boolean), repo.topLevelPath)
    const numberMatch = url.match(/\/pull\/(\d+)/)

    return {
      number: numberMatch?.[1] ? Number(numberMatch[1]) : undefined,
      url,
    }
  })
