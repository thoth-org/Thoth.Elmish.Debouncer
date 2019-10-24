module Demo

// This example has been inspired by:
// https://css-tricks.com/debouncing-throttling-explained-examples/

open Elmish
open Fable.React
open Fable.React.Props
open Fulma
open Thoth.Elmish
open System

type State =
    | Initial
    | IsTyping
    | StoppedTyping

type Model =
    { Debouncer : Debouncer.State
      UserInput : string
      State : State }

type Msg =
    | DebouncerSelfMsg of Debouncer.SelfMessage<Msg>
    | ChangeValue of string
    | EndOfInput
    | Reset

let private init _ =
    { Debouncer = Debouncer.create()
      UserInput = ""
      State = State.Initial }, Cmd.none

let private update msg model =
    match msg with
    | ChangeValue newValue ->
        let (debouncerModel, debouncerCmd) =
            model.Debouncer
            |> Debouncer.bounce (TimeSpan.FromSeconds 1.5) "user_input" EndOfInput

        { model with UserInput = newValue
                     State = State.IsTyping
                     Debouncer = debouncerModel }, Cmd.batch [ Cmd.map DebouncerSelfMsg debouncerCmd ]

    | DebouncerSelfMsg debouncerMsg ->
        let (debouncerModel, debouncerCmd) = Debouncer.update debouncerMsg model.Debouncer
        { model with Debouncer = debouncerModel }, debouncerCmd

    | EndOfInput ->
        let (debouncerModel, debouncerCmd) =
            model.Debouncer
            |> Debouncer.bounce (TimeSpan.FromSeconds 2.5) "reset_demo" Reset

        { model with State = State.StoppedTyping
                     Debouncer = debouncerModel }, Cmd.batch [ Cmd.map DebouncerSelfMsg debouncerCmd ]

    | Reset ->
        { model with UserInput = ""
                     State = State.Initial }, Cmd.none

let private view model dispatch =
    let instruction =
        match model.State with
        | State.Initial -> "Type here, I will detect when you stop typing"
        | State.IsTyping -> "Waiting for more keystrokes... "
        | State.StoppedTyping -> "You stop typing. I will soon reset the demo"

    Field.div [ ]
        [ Label.label [ ]
            [ str instruction ]
          Control.div [ ]
            [ Input.text [ Input.OnChange (fun ev -> dispatch (ChangeValue ev.Value))
                           Input.Value model.UserInput
                           Input.Disabled (model.State = State.StoppedTyping) ] ] ]

open Elmish.React

let start (id : string) =
    Program.mkProgram init update view
    |> Program.withReactSynchronous id
    |> Program.run

open Fable.Core.JsInterop

Browser.Dom.window?startDemo <- start
