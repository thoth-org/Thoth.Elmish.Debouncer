#r "nuget: Fun.Build, 0.3.8"
#r "nuget: Fake.IO.FileSystem, 5.23.1"
#r "nuget: Fake.Core.Environment, 5.23.1"
#r "nuget: Fake.Tools.Git, 5.23.1"
#r "nuget: Fake.Api.GitHub, 5.23.1"
#r "nuget: SimpleExec, 11.0.0"
#r "nuget: BlackFox.CommandLine, 1.0.0"
#r "nuget: FsToolkit.ErrorHandling, 4.6.0"

open Fun.Build
open Fake.IO
open Fake.IO.FileSystemOperators
open Fake.IO.Globbing.Operators
open Fake.Api
open Fake.Tools

let gitOwner = "thoth-org"
let repoName = "Thoth.Elmish.Debouncer"

module Glob =

    open Fake.IO.FileSystemOperators

    let fableJs baseDir = baseDir </> "**/*.fs.js"
    let fableJsMap baseDir = baseDir </> "**/*.fs.js.map"
    let js baseDir = baseDir </> "**/*.js"
    let jsMap baseDir = baseDir </> "**/*.js.map"

// Module to print colored message in the console
module Logger =
    open System

    let consoleColor (fc : ConsoleColor) =
        let current = Console.ForegroundColor
        Console.ForegroundColor <- fc
        { new IDisposable with
              member x.Dispose() = Console.ForegroundColor <- current }

    let warn str = Printf.kprintf (fun s -> use c = consoleColor ConsoleColor.DarkYellow in printf "%s" s) str
    let warnfn str = Printf.kprintf (fun s -> use c = consoleColor ConsoleColor.DarkYellow in printfn "%s" s) str
    let error str = Printf.kprintf (fun s -> use c = consoleColor ConsoleColor.Red in printf "%s" s) str
    let errorfn str = Printf.kprintf (fun s -> use c = consoleColor ConsoleColor.Red in printfn "%s" s) str

module Changelog =

    open System.Text.RegularExpressions
    open System.IO

    let versionRegex = Regex("^## ?\\[?v?([\\w\\d.-]+\\.[\\w\\d.-]+[a-zA-Z0-9])\\]?", RegexOptions.IgnoreCase)

    let getLastVersion () =
        File.ReadLines("CHANGELOG.md")
            |> Seq.tryPick (fun line ->
                let m = versionRegex.Match(line)
                if m.Success then Some m else None)
            |> function
                | None -> failwith "Couldn't find version in changelog file"
                | Some m ->
                    m.Groups.[1].Value

    let isPreRelease (version : string) =
        let regex = Regex(".*(alpha|beta|rc).*", RegexOptions.IgnoreCase)
        regex.IsMatch(version)

    let getNotes (version : string) =
        File.ReadLines("CHANGELOG.md")
        |> Seq.skipWhile(fun line ->
            let m = versionRegex.Match(line)

            if m.Success then
                not (m.Groups.[1].Value = version)
            else
                true
        )
        // Remove the version line
        |> Seq.skip 1
        // Take all until the next version line
        |> Seq.takeWhile (fun line ->
            let m = versionRegex.Match(line)
            not m.Success
        )

module Util =
    open System.IO
    open System.Text.RegularExpressions

    let visitFile (visitor: string -> string) (fileName : string) =
        File.ReadAllLines(fileName)
        |> Array.map (visitor)
        |> fun lines -> File.WriteAllLines(fileName, lines)

    let replaceLines (replacer: string -> Match -> string option) (reg: Regex) (fileName: string) =
        fileName |> visitFile (fun line ->
            let m = reg.Match(line)
            if not m.Success
            then line
            else
                match replacer line m with
                | None -> line
                | Some newLine -> newLine)

module Nuget =
    open System.Text.RegularExpressions
    open System.IO
    open BlackFox.CommandLine
    open FsToolkit.ErrorHandling

    let private needsPublishing (versionRegex: Regex) (newVersion: string) projFile =
        printfn "Project: %s" projFile
        if newVersion.ToUpper().EndsWith("NEXT")
            || newVersion.ToUpper().EndsWith("UNRELEASED")
        then
            Logger.warnfn "Version marked as unreleased version in Changelog, don't publish yet."
            false
        else
            File.ReadLines(projFile)
            |> Seq.tryPick (fun line ->
                let m = versionRegex.Match(line)
                if m.Success then Some m else None)
            |> function
                | None -> failwith "Couldn't find version in project file"
                | Some m ->
                    let sameVersion = m.Groups.[1].Value = newVersion
                    if sameVersion then
                        Logger.warnfn "Already version %s, no need to publish." newVersion
                    not sameVersion

    let push (newVersion : string) (projFile: string) (ctx: Internal.StageContext)=
        asyncResult {
            let versionRegex = Regex("<Version>(.*?)</Version>", RegexOptions.IgnoreCase)

            if needsPublishing versionRegex newVersion projFile then
                let projDir = Path.GetDirectoryName(projFile)

                (versionRegex, projFile) ||> Util.replaceLines (fun line _ ->
                    versionRegex.Replace(line, "<Version>" + newVersion + "</Version>") |> Some)

                do! CmdLine.empty
                    |> CmdLine.appendRaw "dotnet"
                    |> CmdLine.appendRaw "pack"
                    |> CmdLine.appendRaw projFile
                    |> CmdLine.appendPrefix "-c" "Release"
                    |> CmdLine.toString
                    |> ctx.RunCommand

                let file =
                    Directory.GetFiles(projDir </> "bin" </> "Release", "*.nupkg")
                    |> Array.find (fun nupkg -> nupkg.Contains(newVersion))

                let nugetKey = ctx.GetEnvVar "NUGET_KEY"

                let nugetPushCmd =
                    CmdLine.empty
                    |> CmdLine.appendRaw "dotnet"
                    |> CmdLine.appendRaw "nuget"
                    |> CmdLine.appendRaw "push"
                    |> CmdLine.appendRaw file
                    |> CmdLine.appendPrefix "--source" "https://www.nuget.org/api/v2/package"
                    |> CmdLine.appendPrefix "--api-key" nugetKey
                    |> CmdLine.toString

                do! ctx.RunSensitiveCommand($"{nugetPushCmd}")
        }

module Stages =

    let clean =
        stage "Clean" {
            paralle

            run(fun _ ->
                [
                    "src/bin"
                    "src/obj"
                    "demo/bin"
                    "demo/obj"
                    "demo/dist/"
                    "docs_deploy"
                ]
                |> Shell.cleanDirs
            )

            run(fun _ ->
                !!(Glob.fableJs "src")
                ++ (Glob.fableJsMap "src")
                ++ (Glob.fableJs "demo/src")
                ++ (Glob.fableJsMap "demo/src")
                |> Seq.iter Shell.rm
            )
        }

    let pnpmInstall =
        stage "pnpm - install" {
            paralle

            run "pnpm install"
            run "cd demo && pnpm install"
        }

    let dotnetRestore =
        stage "DotnetRestore" {
            paralle

            run "dotnet restore src"
            run "dotnet restore demo"
        }

module Conditions =

    let whenWatch =
        whenCmd {
            name "--watch"
            alias "-w"
            description "Watch for changes and rebuild"
        }

pipeline "Demo" {
    Stages.clean
    Stages.pnpmInstall
    Stages.dotnetRestore

    stage "Watch" {
        Conditions.whenWatch
        workingDir "demo"
        paralle

        run "npx vite"
        run "dotnet fable watch"
    }

    stage "Build" {
        whenNot {
            Conditions.whenWatch
        }
        workingDir "demo"

        run "dotnet fable --noCache"
        run "npx vite build"
    }

    runIfOnlySpecified
}

pipeline "Format" {

    stage "Format" {
        run "dotnet fantomas -r src"
        run "dotnet fantomas -r demo"
    }

}

pipeline "ReleaseDocs" {
    Stages.clean
    Stages.pnpmInstall
    Stages.dotnetRestore

    stage "Build docs site" {
        run "npx nacara"
    }

    stage "Build demo" {
        workingDir "demo"

        run "dotnet fable --noCache"
        run "npx vite build"
    }

    stage "Copy demo files" {
        run(fun _ ->
            Shell.mkdir "./docs_deploy/demo"
            Shell.cp "./demo/dist/assets/index.js" "./docs_deploy/demo"
        )
    }

    stage "Publish docs" {
        run "npx gh-pages -d docs_deploy"
    }

    runIfOnlySpecified
}

pipeline "ReleasePackage" {
    Stages.clean
    Stages.pnpmInstall
    Stages.dotnetRestore

    whenAll {
        envVar "NUGET_KEY"
        envVar "GITHUB_TOKEN_THOTH_ORG"
    }

    stage "Publish nuget package" {
        run (fun ctx ->
            let newVersion = Changelog.getLastVersion()

            Nuget.push newVersion "src/Thoth.Elmish.Debouncer.fsproj" ctx
        )
    }

    stage "Github release" {

        run (fun ctx ->
            let root = __SOURCE_DIRECTORY__
            let version = Changelog.getLastVersion()

            Git.Staging.stageAll root
            let commitMsg = sprintf "Release version %s" version
            Git.Commit.exec root commitMsg
            Git.Branches.push root

            let token = ctx.GetEnvVar "GITHUB_TOKEN_THOTH_ORG"

            GitHub.createClientWithToken token
            |> GitHub.draftNewRelease gitOwner repoName version (Changelog.isPreRelease version) (Changelog.getNotes version)
            |> GitHub.publishDraft
            |> Async.RunSynchronously
        )
    }

    runIfOnlySpecified
}

tryPrintPipelineCommandHelp()
