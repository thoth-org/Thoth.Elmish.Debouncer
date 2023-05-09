import { Union, Record } from "../demo/fable_modules/fable-library.4.1.3/Types.js";
import { union_type, record_type, class_type, int32_type, string_type } from "../demo/fable_modules/fable-library.4.1.3/Reflection.js";
import { remove, tryFind, add, empty } from "../demo/fable_modules/fable-library.4.1.3/Map.js";
import { comparePrimitives } from "../demo/fable_modules/fable-library.4.1.3/Util.js";
import { some, map, defaultArg } from "../demo/fable_modules/fable-library.4.1.3/Option.js";
import { Cmd_none, Cmd_OfPromise_either } from "../demo/fable_modules/Fable.Elmish.4.0.1/cmd.fs.js";
import { PromiseBuilder__Delay_62FBFDE1, PromiseBuilder__Run_212F1D4B } from "../demo/fable_modules/Fable.Promise.3.2.0/Promise.fs.js";
import { promise } from "../demo/fable_modules/Fable.Promise.3.2.0/PromiseImpl.fs.js";
import { singleton } from "../demo/fable_modules/fable-library.4.1.3/List.js";

export class State extends Record {
    constructor(PendingMessages) {
        super();
        this.PendingMessages = PendingMessages;
    }
}

export function State_$reflection() {
    return record_type("Thoth.Elmish.Debouncer.State", [], State, () => [["PendingMessages", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [string_type, int32_type])]]);
}

export function create() {
    return new State(empty({
        Compare: comparePrimitives,
    }));
}

export class SelfMessage$1 extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["Timeout", "OnError"];
    }
}

export function SelfMessage$1_$reflection(gen0) {
    return union_type("Thoth.Elmish.Debouncer.SelfMessage`1", [gen0], SelfMessage$1, () => [[["id", string_type], ["appMsg", gen0]], [["Item", class_type("System.Exception")]]]);
}

export function bounce(delay, id, msgToSend, currentState) {
    return [new State(add(id, defaultArg(map((y) => (1 + y), tryFind(id, currentState.PendingMessages)), 1), currentState.PendingMessages)), Cmd_OfPromise_either(() => PromiseBuilder__Run_212F1D4B(promise, PromiseBuilder__Delay_62FBFDE1(promise, () => ((new Promise(resolve => setTimeout(resolve, ~~delay))).then(() => (Promise.resolve([id, msgToSend])))))), void 0, (tupledArg) => (new SelfMessage$1(0, [tupledArg[0], tupledArg[1]])), (arg_3) => (new SelfMessage$1(1, [arg_3])))];
}

export function update(selfMessage, currentState) {
    if (selfMessage.tag === 0) {
        const id = selfMessage.fields[0];
        const remainingMessages = (defaultArg(tryFind(id, currentState.PendingMessages), 0) - 1) | 0;
        if (remainingMessages === 0) {
            return [new State(remove(id, currentState.PendingMessages)), singleton((dispatch) => {
                dispatch(selfMessage.fields[1]);
            })];
        }
        else if (remainingMessages > 0) {
            return [new State(add(id, remainingMessages, currentState.PendingMessages)), Cmd_none()];
        }
        else {
            console.warn(some("Invalid debouncer state: there was no state information for the supplier id"));
            return [currentState, Cmd_none()];
        }
    }
    else {
        console.error(some(selfMessage.fields[0].message));
        return [currentState, Cmd_none()];
    }
}

