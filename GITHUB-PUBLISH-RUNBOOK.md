# GitHub Publishing Runbook

This runbook explains how this project was published to GitHub and how to
verify, update, and publish future changes from Windows PowerShell. It publishes
source files to GitHub; it does not publish a Docker image. For Docker Hub
publishing, see `README.md`.

## Current repository

- GitHub repository: `https://github.com/shalthoor/docker-testapp-main`
- Remote name: `origin`
- Branch: `main`
- Initial commit: `2ef1a517ce85312888a7aa45c0a9b229d0001207`

The first push has already completed. Do not repeat `git init`, `git remote add`,
or the initial commit commands unless starting from a separate, uninitialized
copy of the project.

## 1. One-time security and content review

Before publishing or changing a repository from private to public:

- Check that `.env` is not staged or tracked. The Compose files read passwords
  from `.env`; `.env.example` contains only a placeholder and is safe to share.
- Check the staged changes for credentials, real personal data, database dumps,
  private keys, machine-specific paths, and files that should stay local.
- `node_modules/`, command history, temporary editor files, local databases,
  keys, and local override files are excluded by `.gitignore`.
- `.gitignore` does not remove files already tracked, and it cannot prevent an
  explicit `git add -f`.
- A secret committed at any point can remain in Git history. Rotate/revoke a
  real exposed secret; deleting it in a later commit is not sufficient.

The first commit records the email configured for its author. That address is
visible in the GitHub commit metadata. To use GitHub's noreply email for future
commits, configure it locally (replace the example with the address shown in
your GitHub email settings):

```powershell
git config user.email "YOUR-GITHUB-NOREPLY-EMAIL"
```

This changes future commits only; it does not rewrite the existing commit.

## 2. Open PowerShell in the project folder

Replace the example path if you moved the folder:

```powershell
Set-Location "C:\path\to\docker-testapp-main"
Get-Location
```

`Get-Location` confirms which folder Git commands will operate on. Confirm that
the expected project files are present:

```powershell
Get-ChildItem -Force
```

## 3. Verify the existing local-to-GitHub connection

These are the commands for the repository as it is configured now:

```powershell
git status --short --branch
git remote -v
git log -1 --oneline
git ls-remote --heads origin
```

What to look for:

- `git status` should show `main...origin/main` and no changed files when fully
  synchronized.
- `git remote -v` should list
  `https://github.com/shalthoor/docker-testapp-main.git` for fetch and push.
- `git log -1` shows the latest local commit.
- `git ls-remote --heads origin` shows the commit ID currently stored on the
  remote `main` branch.

The local `main` commit and remote `main` commit IDs should match. The current
remote was checked and its `main` branch points to
`2ef1a517ce85312888a7aa45c0a9b229d0001207`, matching the local initial commit.

## 4. Confirm the files on GitHub

Open `https://github.com/shalthoor/docker-testapp-main` in a browser. Select
the `main` branch and check that the repository contains the expected source
and project files, including:

- `server.js`, `app-users/server.js`, and `public/`
- `package.json`, `package-lock.json`, and `Dockerfile`
- `.gitignore` and `.env.example`
- the MongoDB YAML files and the project README/runbooks

The repository's `main` commit and root file listing were checked against the
local project. The committed tree contains the expected app, frontend,
dependency manifests, Docker files, Compose files, and documentation. This is a
source-control/file-presence check, not a remote deployment or a live runtime
test.

Optional CLI verification, if GitHub CLI is installed and authenticated:

```powershell
gh repo view shalthoor/docker-testapp-main --json name,url,visibility,defaultBranchRef
gh api repos/shalthoor/docker-testapp-main/contents --jq '.[].name'
```

The first command reports repository visibility and the default branch. The
second prints the files in the remote repository root.

## 5. Test the project before publishing later changes

From the project folder, check both JavaScript entry files:

```powershell
node --check .\server.js
node --check .\app-users\server.js
```

If Docker Desktop and Compose are installed, validate each MongoDB Compose
configuration without starting containers. A placeholder value is used only
for validation; do not use it as an actual password:

```powershell
$env:MONGO_ROOT_PASSWORD = "validation-only-not-a-real-secret"
docker compose -f .\mongodb-basic.yaml config --quiet
docker compose -f .\mongodb-healthcheck.yaml config --quiet
docker compose -f .\mongodb-volume.yaml config --quiet
docker compose -f .\mongodb.yaml config --quiet
Remove-Item Env:\MONGO_ROOT_PASSWORD
```

For local Compose use, copy the example and edit the ignored local `.env` file
with a strong password before starting MongoDB:

```powershell
Copy-Item .\.env.example .\.env
notepad .\.env
docker compose -f .\mongodb-volume.yaml config --quiet
```

Never stage or publish `.env`.

## 6. Publish new changes to the existing repository

After making a change, inspect the worktree and review the actual edits before
staging:

```powershell
git status --short
git diff
```

`git status` lists modified and untracked files. `git diff` shows edits to
already tracked files. To inspect a new untracked file, open it directly or add
it and inspect the staged diff before committing.

Stage the intended changes:

```powershell
git add -A
git status --short
git diff --cached --check
git diff --cached --stat
git diff --cached
```

`git add -A` stages additions, edits, and removals. The cached commands check
and show exactly what the next commit will contain. If a file should not be
included, unstage just that file while preserving it on disk:

```powershell
git restore --staged -- path\to\file
```

Do not run `git restore --staged .` to undo an initial add before the first
commit; with no existing `HEAD`, it may fail. Review and unstage specific files
instead.

Once the staged diff is correct, create a commit and push it:

```powershell
git commit -m "Describe the change"
git push
```

`git commit` saves a snapshot locally. `git push` uploads the new commit to the
configured remote. Verify the result:

```powershell
git status --short --branch
git log -1 --oneline
git ls-remote --heads origin
```

The branch should again show `main...origin/main` with no pending changes, and
the local and remote `main` commit IDs should match.

## 7. First-time publishing from a separate local copy

Use this section only for a project copy that is not yet a Git repository.
Create an empty GitHub repository first. Do not initialize it with a README,
license, or `.gitignore` when uploading an existing project.

From the project directory:

```powershell
git init -b main
git status --short --ignored
```

`git init` creates the local repository and `main` branch. `git status` lets you
check that ignored files such as `node_modules/` and `.env` will not be added.
Stage and review:

```powershell
git add -A
git status --short
git diff --cached --check
git diff --cached --stat
git diff --cached
```

Set the commit author if it is not already configured:

```powershell
git config user.name "Your Name"
git config user.email "YOUR-GITHUB-NOREPLY-EMAIL"
```

These settings identify commits; they do not sign in to GitHub. Commit the
reviewed files:

```powershell
git commit -m "Initial project import"
```

Connect the empty GitHub repository. For this project, the remote URL is:

```powershell
git remote add origin https://github.com/shalthoor/docker-testapp-main.git
git remote -v
git push -u origin main
```

`-u` sets `origin/main` as the upstream for local `main`, so later pushes can
use `git push` without repeating the remote and branch names. Authenticate using
the browser flow from Git Credential Manager if prompted. Never place a
password or access token in the URL or source files.

## 8. Common problems

### `remote origin already exists`

Check the current URL before changing it:

```powershell
git remote -v
```

If it is wrong, update it:

```powershell
git remote set-url origin https://github.com/shalthoor/docker-testapp-main.git
```

### Push rejected because remote has other commits

The GitHub repository may have been initialized with files or commits. Do not
force-push. Inspect the local and remote histories first. For a new repository,
using an empty GitHub repository avoids this conflict.

### A file is tracked despite `.gitignore`

Ignore rules do not untrack files already added. To stop tracking a particular
file while keeping its local copy:

```powershell
git rm --cached -- path\to\file
```

Then update `.gitignore`, review the staged diff, commit, and push. If that file
contained a real credential, rotate it and address the exposed Git history.

### Authentication failed

Use the browser sign-in flow through Git Credential Manager, or install and
authenticate GitHub CLI. A GitHub account password is not the HTTPS Git
authentication method.

## Completion checklist

- [x] `origin` points to `https://github.com/shalthoor/docker-testapp-main.git`.
- [x] Local branch `main` is pushed to remote branch `main`.
- [x] Remote commit matches the local initial commit.
- [x] Expected source, dependency, Docker, MongoDB, and documentation files are
  present in the remote repository.
- [ ] For any later changes: review, stage, commit, push, and verify again.
