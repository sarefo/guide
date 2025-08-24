# /wrap [version] - increase version and commit to github

Usage: `/wrap [version]`

When this command is used:
1. always update `this.buildDate` in app.js to the current time. use Bash(date '+%Y-%m-%d %H:%M') for this
2. only if the user added "version" to the commandnd: increase the version of the app (patch level)
3. commit all changes to github
