---
title: Thoth.Elmish.Debouncer
layout: standard
---

# Debouncer

## Kezako ?

> Debouncing enforces that a function not be called again until a certain amount of time has passed without it being called. As in "execute this function only if 100 milliseconds have passed without it being called."
>
> Perhaps a function is called 1,000 times in a quick burst, dispersed over 3 seconds, then stops being called. If you have debounced it at 100 milliseconds, the function will only fire once, at 3.1 seconds, once the burst is over. Each time the function is called during the burst it resets the debouncing timer.
>
> [Source](https://css-tricks.com/the-difference-between-throttling-and-debouncing/)

## Demo

The demo works as follows:

1. Ask the user to type something
2. The user **is typing**
3. When the user **stops typing**, **disable** the input and **inform** the user.
4. After a **short period** of time, **reset** the demo.

<div class="columns">
    <div class="column is-6 is-offset-3">
        <div id="debouncer_demo"></div>
    </div>
</div>

<div class="has-text-centered">

*[View the code](https://github.com/MangelMaxime/Thoth/blob/master/demos/Thoth.Elmish.Demo/src/Debouncer.fs)*
</div>

<script type="text/javascript" src="/Thoth.Elmish.Debouncer/demo/index.js"></script>
<script type="text/javascript">
    startDemo("debouncer_demo");
</script>

## How to use ?

1. Store the `Debouncer` instance in your model
```fsharp
// Model definition
type Model =
    { Debouncer : Debouncer.State
      // ...
    }

// Model initialization
let init () =
    { Debouncer = Debouncer.create()
      // ...
    }
```

2. Register the message dedicated to the `Debouncer`

```fsharp
// Msg definition
type Msg =
    | DebouncerSelfMsg of Debouncer.SelfMessage<Msg> // This is the message used by the Debouncer
    | ChangeValue of string // Message trigger each time the user type in the input
    | EndOfInput // Message we want to debounce
```

3. Handle `DebouncerSelfMsg` in your update function

```fsharp
let private update msg model =
    match msg with
    | DebouncerSelfMsg debouncerMsg ->
        let (debouncerModel, debouncerCmd) = Debouncer.update debouncerMsg model.Debouncer
        { model with Debouncer = debouncerModel }, debouncerCmd
```

*Please note we don't need to use `Cmd.map` over `debouncerCmd` because it return a `Msg` directly*

4. Bounce `EndOfInput` each time the user types something in the input

```fsharp
let private update msg model =
    match msg with
    | ChangeValue newValue ->
        let (debouncerModel, debouncerCmd) =
            model.Debouncer
            |> Debouncer.bounce (TimeSpan.FromSeconds 1.5) "user_input" EndOfInput

        { model with UserInput = newValue
                     State = State.IsTyping
                     Debouncer = debouncerModel }, Cmd.batch [ Cmd.map DebouncerSelfMsg debouncerCmd ]
```

`Debouncer.bounce` parameters:
```fsharp
val bounce:
   delay       : TimeSpan        -> // Delay before trying to send `msgToSend`
   id          : Debouncer.Id    -> // Id used to identify the message in the debouncer. This is useful if you want to debounce a different message
   msgToSend   : 'a              -> // The `Msg` to send
   currentState: Debouncer.State    // Current debouncer state
              -> Debouncer.State * Cmd<Debouncer.SelfMessage<'a>>
```
