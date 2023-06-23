'use strict';

const immer = require('immer');
const uuid = require('uuid');
const vanilla = require('zustand/vanilla');
const zustand = require('zustand');

immer.enablePatches();
immer.enableMapSet();
function createCommando(config) {
  let store = vanilla.createStore()(() => ({
    current: config.initialState,
    transactions: /* @__PURE__ */ new Map(),
    undoStack: [],
    redoStack: []
  }));
  let commands = /* @__PURE__ */ new Map();
  return {
    store,
    useBoundStore: (selector) => zustand.useStore(store, (state) => selector(state.current)),
    getState: () => store.getState().current,
    dispatch(evt) {
      const cmd = commands.get(evt.type);
      if (!cmd)
        return;
      const nextState = immer.produce(store.getState(), (draft) => {
        const [nextCurrent, txn] = execCommand(cmd, draft.current, evt);
        draft.current = nextCurrent;
        draft.transactions.set(txn.id, txn);
        draft.undoStack.push(txn.id);
      });
      store.setState(nextState);
    },
    undo() {
      const nextState = immer.produce(store.getState(), (draft) => {
        const txn = draft.transactions.get(draft.undoStack.pop() ?? "");
        if (!txn)
          return;
        const cmd = commands.get(txn.type);
        if (!cmd)
          return;
        const [nextCurrent, nextTxn] = undoCommand(cmd, draft.current, txn);
        draft.current = nextCurrent;
        draft.transactions.set(nextTxn.id, nextTxn);
        draft.redoStack.push(nextTxn.id);
      });
      store.setState(nextState);
    },
    redo() {
      const nextState = immer.produce(store.getState(), (draft) => {
        const txn = draft.transactions.get(draft.redoStack.pop() ?? "");
        if (!txn)
          return;
        const cmd = commands.get(txn.type);
        if (!cmd)
          return;
        const [nextCurrent, nextTxn] = redoCommand(cmd, draft.current, txn);
        draft.current = nextCurrent;
        draft.transactions.set(nextTxn.id, nextTxn);
        draft.undoStack.push(nextTxn.id);
      });
      store.setState(nextState);
    },
    createCommand(config2) {
      const cmd = {
        ...config2,
        create: (input) => ({
          ...config2.create(input),
          type: config2.type
        })
      };
      commands.set(cmd.type, cmd);
      return cmd;
    }
  };
}
function execCommand(cmd, state, evt) {
  const [nextCurrent, patches, inversePatches] = immer.produceWithPatches(
    state,
    (current) => cmd.exec(current, evt)
  );
  const txn = createTransaction(evt, patches, inversePatches);
  return [nextCurrent, txn];
}
function undoCommand(cmd, state, txn) {
  const [nextCurrent, patches, inversePatches] = immer.produceWithPatches(
    state,
    (current) => cmd.undo(current, txn, {
      revertWithPatches: () => {
        immer.applyPatches(current, txn.inversePatches);
      }
    })
  );
  const nextTxn = createTransaction(txn.evt, inversePatches, patches);
  return [nextCurrent, nextTxn];
}
function redoCommand(cmd, state, txn) {
  const [nextCurrent, patches, inversePatches] = immer.produceWithPatches(
    state,
    (current) => cmd.redo(current, txn, {
      revertWithPatches: () => {
        immer.applyPatches(current, txn.inversePatches);
      }
    })
  );
  const nextTxn = createTransaction(txn.evt, patches, inversePatches);
  return [nextCurrent, nextTxn];
}
function createTransaction(evt, patches, inversePatches) {
  return {
    id: uuid.v4(),
    type: evt.type,
    evt,
    patches,
    inversePatches
  };
}

exports.applyPatches = immer.applyPatches;
exports.createCommando = createCommando;
