import { expect, test } from 'vitest';
import { applyPatches, createCommando } from './index.js';

test('can execute and undo commands', () => {
  const commando = createCommando({
    initialState: {
      foo: 'bar',
    },
  });

  const cmd = commando.createCommand({
    type: 'SET_FOO',
    create: (params: { before: string; after: string }) => {
      return { payload: { ...params } };
    },
    exec: (state, evt) => {
      state.foo = evt.payload.after;
    },
    undo: (state, txn) => {
      state.foo = txn.evt.payload.before;
    },
    redo: (state, txn) => {
      state.foo = txn.evt.payload.after;
    },
  });

  commando.dispatch(
    cmd.create({
      before: 'a',
      after: 'b',
    }),
  );

  let state = commando.store.getState();
  expect(state.undoStack).toHaveLength(1);
  expect(state.redoStack).toHaveLength(0);
  expect(state.current).toMatchInlineSnapshot(`
    {
      "foo": "b",
    }
  `);

  commando.undo();
  state = commando.store.getState();
  expect(state.undoStack).toHaveLength(0);
  expect(state.redoStack).toHaveLength(1);
  expect(state.current).toMatchInlineSnapshot(`
    {
      "foo": "a",
    }
  `);

  commando.redo();
  state = commando.store.getState();
  expect(state.undoStack).toHaveLength(1);
  expect(state.redoStack).toHaveLength(0);
  expect(state.current).toMatchInlineSnapshot(`
    {
      "foo": "b",
    }
  `);
});

test('can undo commands with patches', () => {
  const commando = createCommando({
    initialState: {
      foo: 'bar',
    },
  });

  const cmd = commando.createCommand({
    type: 'SET_FOO',
    create: (newValue: string) => {
      return { payload: newValue };
    },
    exec: (state, evt) => {
      state.foo = evt.payload;
    },
    undo: (_state, _txn, ctx) => {
      ctx.revertWithPatches();
    },
    redo: (state, txn) => {
      applyPatches(state, txn.patches);
    },
  });

  commando.dispatch(cmd.create('b'));

  expect(commando.getState()).toMatchInlineSnapshot(`
    {
      "foo": "b",
    }
  `);

  commando.undo();

  expect(commando.getState()).toMatchInlineSnapshot(`
    {
      "foo": "bar",
    }
  `);

  commando.redo();

  expect(commando.getState()).toMatchInlineSnapshot(`
    {
      "foo": "b",
    }
  `);
});

test('can undo, change, then redo', () => {
  const commando = createCommando({
    initialState: {
      color: 'red',
      animal: 'dog',
    },
  });

  const setColor = commando.createCommand({
    type: 'SET_COLOR',
    create: (newValue: string) => {
      return { payload: newValue };
    },
    exec: (state, evt) => {
      state.color = evt.payload;
    },
    undo: (_state, _txn, ctx) => {
      ctx.revertWithPatches();
    },
    redo: (state, txn) => {
      applyPatches(state, txn.patches);
    },
  });

  const setAnimal = commando.createCommand({
    type: 'SET_ANIMAL',
    create: (newValue: string) => {
      return { payload: newValue };
    },
    exec: (state, evt) => {
      state.animal = evt.payload;
    },
    undo: (_state, _txn, ctx) => {
      ctx.revertWithPatches();
    },
    redo: (state, txn) => {
      applyPatches(state, txn.patches);
    },
  });

  commando.dispatch(setAnimal.create('cat'));
  expect(commando.getState()).toMatchInlineSnapshot(`
    {
      "animal": "cat",
      "color": "red",
    }
  `);

  commando.dispatch(setColor.create('blue'));
  expect(commando.getState()).toMatchInlineSnapshot(`
    {
      "animal": "cat",
      "color": "blue",
    }
  `);

  commando.dispatch(setColor.create('purple'));
  expect(commando.getState()).toMatchInlineSnapshot(`
    {
      "animal": "cat",
      "color": "purple",
    }
  `);

  commando.undo();
  commando.undo();

  commando.dispatch(setAnimal.create('monkey'));
  expect(commando.getState()).toMatchInlineSnapshot(`
    {
      "animal": "monkey",
      "color": "red",
    }
  `);

  commando.redo();
  commando.redo();
  expect(commando.getState()).toMatchInlineSnapshot(`
    {
      "animal": "monkey",
      "color": "purple",
    }
  `);
});
