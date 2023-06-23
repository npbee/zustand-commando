import * as zustand from 'zustand';
import { Patch } from 'immer';
export { applyPatches } from 'immer';

interface Evt<Type extends string, Payload, Meta> {
    type: Type;
    payload: Payload;
    meta?: Meta;
}
type AnyEvt = Evt<any, any, any>;
interface Ctx {
    revertWithPatches(): void;
}
interface Command<Type extends string, State extends object, Input, Payload, Meta, E extends Evt<Type, Payload, Meta>> {
    type: Type;
    exec: (state: State, evt: E) => void;
    create: (input: Input) => Evt<Type, Payload, Meta>;
    undo: (state: State, txn: TransactionType<E>, ctx: Ctx) => void;
    redo: (state: State, txn: TransactionType<E>, ctx: Ctx) => void;
}
interface TransactionType<Evt extends AnyEvt> {
    id: string;
    type: Evt['type'];
    evt: Evt;
    patches: Patch[];
    inversePatches: Patch[];
}
interface State<UserState extends object> {
    current: UserState;
    transactions: Map<string, TransactionType<any>>;
    undoStack: string[];
    redoStack: string[];
}
declare function createCommando<UserState extends {}>(config: {
    initialState: UserState;
}): {
    store: zustand.StoreApi<State<UserState>>;
    useBoundStore: <Selected>(selector: (state: UserState) => Selected) => Selected;
    getState: () => UserState;
    dispatch(evt: AnyEvt): void;
    undo(): void;
    redo(): void;
    createCommand<Type extends string, Input, Payload, Meta, E extends Evt<Type, Payload, Meta>>(config: Omit<Command<Type, UserState, Input, Payload, Meta, E>, "create"> & {
        create: (input: Input) => Omit<Evt<Type, Payload, Meta>, "type">;
    }): Command<Type, UserState, Input, Payload, Meta, E>;
};

export { AnyEvt, Evt, createCommando };
