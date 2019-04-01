const spawn = require('child_process').spawn;
const chalk = require("chalk").default;
const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const parseChangelog = require('changelog-parser');
const git = require('simple-git/promise')().outputHandler((command, stdout, stderr) => {
    stdout.pipe(process.stdout);
    stderr.pipe(process.stderr);
 });
const log = console.log;
const request = require('request-promise-native');

class Dotnet {
    static exec(args, options) {
        return new Promise((resolve, reject) => {
            const dotnet = spawn("dotnet", args, options);

            dotnet.stderr.on("data", (chunk) => {
                log(chalk.red(chunk));
            });

            dotnet.stdout.on("data", (chunk) => {
                // Try to detect error because Dotnet don't use `strerr` ...
                if (chunk.toString().toLowerCase().indexOf("error") > -1) {
                    log(chalk.red(chunk));
                } else {
                    log(chalk.white(chunk));
                }
            });

            dotnet.on("exit", (exitCode) => {
                if (exitCode === 0) {
                    resolve();
                } else {
                    reject();
                }
            });

            dotnet.on("error", (error) => {
                reject(error);
            });
        });
    }

    static restore(opts) {
        const options = {
            cwd: opts.cwd === null ? __dirname : opts.cwd
        }

        return Dotnet.exec(["restore"], options);
    }

    static build(opts) {
        const options = {
            cwd: opts.cwd === null ? __dirname : opts.cwd
        }

        const args = ["build"];

        if (opts.configuration !== undefined && typeof (opts.configuration === "String")) {
            args.push("--configuration");
            args.push(opts.configuration);
        }

        if (opts.noRestore === true) {
            args.push("--no-restore");
        }

        return Dotnet.exec(args, options);
    }

    static pack(opts) {
        const options = {
            cwd: opts.cwd === null ? __dirname : opts.cwd
        }

        const args = ["pack"];

        if (opts.configuration !== undefined && typeof (opts.configuration === "String")) {
            args.push("--configuration");
            args.push(opts.configuration);
        }

        if (opts.noRestore === true) {
            args.push("--no-restore");
        }

        return Dotnet.exec(args, options);
    }

    static push(opts) {
        const options = {
            cwd: opts.cwd === null ? __dirname : opts.cwd
        }

        const args = ["nuget", "push"];

        args.push("--source");
        if (opts.source !== undefined && typeof (opts.source === "String")) {
            args.push(opts.source);
        } else {
            args.push("https://www.nuget.org/api/v2/package");
        }

        if (opts.apiKey !== undefined && typeof (opts.apiKey === "String")) {
            args.push("--api-key");
            args.push(opts.apiKey);
        }

        if (opts.pattern !== undefined && typeof (opts.pattern === "String")) {
            args.push(opts.pattern);
        }

        return Dotnet.exec(args, options);
    }
}

class Task {
    constructor(name, func) {
        this.name = name;
        this.func = func;
    }

    run() {
        const hrstart = process.hrtime();
        log(chalk.green(`Started: ${this.name}`));
        return new Promise((resolve, reject) => {
            this.func()
                .then(() => {
                    const hrend = process.hrtime(hrstart);
                    log(chalk.green(`Finished: ${this.name} in ${hrend[0]}s ${hrend[1] / 1000000}ms`));
                    resolve(true);
                })
                .catch((error) => {
                    log(chalk.red(`Error: ${this.name}`));
                    if (error !== undefined)
                        log(chalk.red(error));
                    resolve(false);
                });
        });
    }
}

class Runner {
    constructor(tasks) {
        this.tasks = tasks;
    }

    async run() {
        let success = true;
        const hrstart = process.hrtime();
        for (const task of this.tasks) {
            try {
                success = await task.run();

                if (!success)
                    break;
            } catch (error) {
                console.log(error);
                success = false;
                break;
            }
        }
        const hrend = process.hrtime(hrstart);

        if (success) {
            log(chalk.green(`Execution time: ${hrend[0]}s ${hrend[1] / 1000000}ms`));
            log(chalk.green("Finished"));
        } else {
            log(chalk.green(`Execution time: ${hrend[0]}s ${hrend[1] / 1000000}ms`));
            log(chalk.red("Build stopped due to an error"));
        }
    }
}

const getLastVersion = async () => {
    const versionRegx = /^## ?\[?v?([\w\d.-]+\.[\w\d.-]+[a-zA-Z0-9])\]?/gm;

    const fileContent = fs.readFileSync(path.join(__dirname, "CHANGELOG.md")).toString();

    const m = versionRegx.exec(fileContent);

    if (m === null)
        throw "No valid version found in the CHANGELOG";

    return m[1];
}

const projectName = "Thoth.Elmish.Debouncer";
const owner = "thoth-org";
const repo = "Thoth.Elmish.Debouncer";

const clean =
    new Task("Clean", async () => {
        return shell.rm("-rf", [
            "src/**/bin",
            "src/**/obj"
        ]);
    });

const restore =
    new Task("Restore", () => Dotnet.restore({
        cwd: "src"
    }));

const build =
    new Task("Build", () => Dotnet.build({
        cwd: "src",
        noRestore: true
    }));

const upgradeVersion =
    new Task("Upgrade version", async () => {
        const version = await getLastVersion();
        const projectFile = path.join(__dirname, "src", `${projectName}.fsproj`);
        const versionInProjectFileRegex = /(<(Version|PackageVersion)>)([\w\d.-]+)(<\/(Version|PackageVersion)>)/gm;
        const updatedContent =
            fs.readFileSync(projectFile)
                .toString()
                .replace(versionInProjectFileRegex, `$1${version}$4`);

        fs.writeFileSync(projectFile, updatedContent);
    });

const pack =
    new Task("Package", () => Dotnet.pack({
        cwd: "src",
        configuration: "Release",
        noRestore: true
    }));

const publishToNuget =
    new Task("Publish", async () => {
        const version = await getLastVersion();

        if (process.env.NUGET_KEY === undefined)
            throw "The Nuget API key must be set in a NUGET_KEY environmental variable"

        return await Dotnet.push({
            cwd: "src",
            pattern: `bin/Release/${projectName}.${version}.nupkg`,
            apiKey: process.env.NUGET_KEY
        });
    });

const releaseToGithub =
    new Task("Release", async () => {
        const version = await getLastVersion();
        const changelog = await parseChangelog({
            filePath: path.join(__dirname, "CHANGELOG.md")
        });
        const versionInfo =
            changelog.versions.find((versionInfo) => {
                return (versionInfo.version === version)
            });

        if (versionInfo === null)
            throw `Unable to find the version info for ${version}`;

        const isPreRelease = /.*(alpha|beta|rc).*/.test(version);

        const status = await git.status();

        if (!status.isClean()) {
            await git.add(status.files.map((file) => file.path));

            log(chalk.cyan(`Changes found in the repo. We are including them in the commit`));
            await git.commit(`Release version ${version}`);
        }

        await git.push();

        if (process.env.GITHUB_TOKEN === undefined)
            throw "The Github token must be set in a GITHUB_TOKEN environmental variable"


        const httpOptions = {
            url: `https://api.github.com/repos/${owner}/${repo}/releases`,
            method: "POST",
            headers: {
                'User-Agent': 'Build.js script',
                Authorization: ` token ${process.env.GITHUB_TOKEN}`
            },
            json: true,
            body: {
                tag_name: versionInfo.version,
                target_commitish: status.current,
                name: versionInfo.title,
                body: versionInfo.body,
                draft: false,
                prerelease: isPreRelease
            }
        };

        try {
            const res = await request(httpOptions);
            log(chalk.green(`Github released created`));
            log(chalk.green(`URL: ${res.html_url}`));
        } catch (err) {
            log(chalk.red(`An error occured while release on Github`));
            throw err
        }
    });

new Runner([
    clean,
    restore,
    build,
    upgradeVersion,
    pack,
    publishToNuget,
    releaseToGithub
]).run()
