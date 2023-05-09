import { Record, Union } from "../fable_modules/fable-library.4.1.3/Types.js";
import { record_type, string_type, union_type } from "../fable_modules/fable-library.4.1.3/Reflection.js";
import { bounce, update as update_1, create, SelfMessage$1_$reflection, State_$reflection as State_$reflection_1 } from "../../src/Debouncer.fs.js";
import { Cmd_map, Cmd_batch, Cmd_none } from "../fable_modules/Fable.Elmish.4.0.1/cmd.fs.js";
import { fromSeconds } from "../fable_modules/fable-library.4.1.3/TimeSpan.js";
import { ofArray, empty, singleton } from "../fable_modules/fable-library.4.1.3/List.js";
import { div } from "../fable_modules/Fulma.3.0.0/Elements/Form/Field.fs.js";
import { label } from "../fable_modules/Fulma.3.0.0/Elements/Form/Label.fs.js";
import { div as div_1 } from "../fable_modules/Fulma.3.0.0/Elements/Form/Control.fs.js";
import { input } from "../fable_modules/Fulma.3.0.0/Elements/Form/./Input.fs.js";
import { Option, IInputType } from "../fable_modules/Fulma.3.0.0/Elements/Form/Input.fs.js";
import { equals } from "../fable_modules/fable-library.4.1.3/Util.js";
import { ProgramModule_mkProgram, ProgramModule_run } from "../fable_modules/Fable.Elmish.4.0.1/program.fs.js";
import { Program_withReactSynchronous } from "../fable_modules/Fable.Elmish.React.4.0.0/react.fs.js";
import "./scss/main.scss";


export class State extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Initial", "IsTyping", "StoppedTyping"];
    }
}

export function State_$reflection() {
    return union_type("Demo.State", [], State, () => [[], [], []]);
}

export class Model extends Record {
    constructor(Debouncer, UserInput, State) {
        super();
        this.Debouncer = Debouncer;
        this.UserInput = UserInput;
        this.State = State;
    }
}

export function Model_$reflection() {
    return record_type("Demo.Model", [], Model, () => [["Debouncer", State_$reflection_1()], ["UserInput", string_type], ["State", State_$reflection()]]);
}

export class Msg extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["DebouncerSelfMsg", "ChangeValue", "EndOfInput", "Reset"];
    }
}

export function Msg_$reflection() {
    return union_type("Demo.Msg", [], Msg, () => [[["Item", SelfMessage$1_$reflection(Msg_$reflection())]], [["Item", string_type]], [], []]);
}

function init(_arg) {
    return [new Model(create(), "", new State(0, [])), Cmd_none()];
}

function update(msg, model) {
    switch (msg.tag) {
        case 0: {
            const patternInput_1 = update_1(msg.fields[0], model.Debouncer);
            return [new Model(patternInput_1[0], model.UserInput, model.State), patternInput_1[1]];
        }
        case 2: {
            const patternInput_2 = bounce(fromSeconds(2.5), "reset_demo", new Msg(3, []), model.Debouncer);
            return [new Model(patternInput_2[0], model.UserInput, new State(2, [])), Cmd_batch(singleton(Cmd_map((arg_1) => (new Msg(0, [arg_1])), patternInput_2[1])))];
        }
        case 3:
            return [new Model(model.Debouncer, "", new State(0, [])), Cmd_none()];
        default: {
            const patternInput = bounce(fromSeconds(1.5), "user_input", new Msg(2, []), model.Debouncer);
            return [new Model(patternInput[0], msg.fields[0], new State(1, [])), Cmd_batch(singleton(Cmd_map((arg) => (new Msg(0, [arg])), patternInput[1])))];
        }
    }
}

function view(model, dispatch) {
    let matchValue;
    return div(empty(), ofArray([label(empty(), singleton((matchValue = model.State, (matchValue.tag === 1) ? "Waiting for more keystrokes... " : ((matchValue.tag === 2) ? "You stop typing. I will soon reset the demo" : "Type here, I will detect when you stop typing")))), div_1(empty(), singleton(input(ofArray([new Option(1, [new IInputType(0, [])]), new Option(13, [(ev) => {
        dispatch(new Msg(1, [ev.target.value]));
    }]), new Option(8, [model.UserInput]), new Option(4, [equals(model.State, new State(2, []))])]))))]));
}

export function start(id) {
    ProgramModule_run(Program_withReactSynchronous(id, ProgramModule_mkProgram(() => init(void 0), update, view)));
}

window.startDemo = ((id) => {
    start(id);
});

