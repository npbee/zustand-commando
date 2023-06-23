import {
  produce,
  enablePatches,
  enableMapSet,
  produceWithPatches,
  Patch,
  applyPatches,
} from 'immer';
import { v4 as uuid } from 'uuid';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

export { applyPatches } from 'immer';

enablePatches();
enableMapSet();

export interface Evt<Type extends string, Payload, Meta> {
  type: Type;
  payload: Payload;
  meta?: Meta;
}

export type AnyEvt = Evt<any, any, any>;

interface Ctx {
  revertWithPatches(): void;
}

interface Command<
  Type extends string,
  State extends object,
  Input,
  Payload,
  Meta,
  E extends Evt<Type, Payload, Meta>,
> {
  type: Type;
  exec: (state: State, evt: E) => void;
  create: (input: Input) => Evt<Type, Payload, Meta>;
  undo: (state: State, txn: TransactionType<E>, ctx: Ctx) => void;
  redo: (state: State, txn: TransactionType<E>, ctx: Ctx) => void;
}

type AnyCmd = Command<any, any, any, any, any, any>;

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

export function createCommando<UserState extends {}>(config: {
  initialState: UserState;
}) {
  let store = createStore<State<UserState>>()(() => ({
    current: config.initialState,
    transactions: new Map(),
    undoStack: [],
    redoStack: [],
  }));

  let commands = new Map<string, AnyCmd>();

  return {
    store,
    useBoundStore: <Selected>(
      selector: (state: UserState) => Selected,
    ): Selected => useStore(store, (state) => selector(state.current)),
    getState: () => store.getState().current,
    dispatch(evt: AnyEvt) {
      const cmd = commands.get(evt.type);
      if (!cmd) return;
      const nextState = produce(store.getState(), (draft) => {
        const [nextCurrent, txn] = execCommand(cmd, draft.current, evt);
        draft.current = nextCurrent;
        draft.transactions.set(txn.id, txn);
        draft.undoStack.push(txn.id);
      });
      store.setState(nextState);
    },
    undo() {
      const nextState = produce(store.getState(), (draft) => {
        const txn = draft.transactions.get(draft.undoStack.pop() ?? '');
        if (!txn) return;
        const cmd = commands.get(txn.type);
        if (!cmd) return;
        const [nextCurrent, nextTxn] = undoCommand(cmd, draft.current, txn);
        draft.current = nextCurrent;
        draft.transactions.set(nextTxn.id, nextTxn);
        draft.redoStack.push(nextTxn.id);
      });
      store.setState(nextState);
    },
    redo() {
      const nextState = produce(store.getState(), (draft) => {
        const txn = draft.transactions.get(draft.redoStack.pop() ?? '');
        if (!txn) return;
        const cmd = commands.get(txn.type);
        if (!cmd) return;
        const [nextCurrent, nextTxn] = redoCommand(cmd, draft.current, txn);
        draft.current = nextCurrent;
        draft.transactions.set(nextTxn.id, nextTxn);
        draft.undoStack.push(nextTxn.id);
      });
      store.setState(nextState);
    },

    createCommand<
      Type extends string,
      Input,
      Payload,
      Meta,
      E extends Evt<Type, Payload, Meta>,
    >(
      config: Omit<
        Command<Type, UserState, Input, Payload, Meta, E>,
        'create'
      > & {
        create: (input: Input) => Omit<Evt<Type, Payload, Meta>, 'type'>;
      },
    ): Command<Type, UserState, Input, Payload, Meta, E> {
      const cmd = {
        ...config,
        create: (input: Input) => ({
          ...config.create(input),
          type: config.type,
        }),
      };
      commands.set(cmd.type, cmd);
      return cmd;
    },
  };
}

function execCommand<
  C extends AnyCmd,
  State extends object,
  Evt extends AnyEvt,
>(cmd: C, state: State, evt: Evt): [State, TransactionType<any>] {
  const [nextCurrent, patches, inversePatches] = produceWithPatches(
    state,
    (current) => cmd.exec(current, evt),
  );
  const txn = createTransaction(evt, patches, inversePatches);
  return [nextCurrent, txn];
}

function undoCommand<
  C extends AnyCmd,
  State extends object,
  Txn extends TransactionType<any>,
>(cmd: C, state: State, txn: Txn): [State, TransactionType<any>] {
  const [nextCurrent, patches, inversePatches] = produceWithPatches(
    state,
    (current) =>
      cmd.undo(current, txn, {
        revertWithPatches: () => {
          applyPatches(current, txn.inversePatches);
        },
      }),
  );
  // Note patches are passed in reverse here
  const nextTxn = createTransaction(txn.evt, inversePatches, patches);
  return [nextCurrent, nextTxn];
}

function redoCommand<
  C extends AnyCmd,
  State extends object,
  Txn extends TransactionType<any>,
>(cmd: C, state: State, txn: Txn): [State, TransactionType<any>] {
  const [nextCurrent, patches, inversePatches] = produceWithPatches(
    state,
    (current) =>
      cmd.redo(current, txn, {
        revertWithPatches: () => {
          applyPatches(current, txn.inversePatches);
        },
      }),
  );
  const nextTxn = createTransaction(txn.evt, patches, inversePatches);
  return [nextCurrent, nextTxn];
}

function createTransaction(
  evt: AnyEvt,
  patches: Patch[],
  inversePatches: Patch[],
) {
  return {
    id: uuid(),
    type: evt.type,
    evt,
    patches,
    inversePatches,
  };
}
