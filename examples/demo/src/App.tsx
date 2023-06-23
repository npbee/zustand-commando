import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import { createCommando } from 'zustand-commando';

const commando = createCommando({
  initialState: {
    count: 0,
  },
});

const inc = commando.createCommand({
  type: 'INC',
  create: () => ({ payload: {} }),
  exec: (state) => {
    state.count++;
  },
  undo: (state) => {
    state.count--;
  },
  redo: (state) => {
    state.count++;
  },
});

function App() {
  const count = commando.useBoundStore((state) => state.count);

  return (
    <>
      <div>
        <button onClick={commando.undo}>Undo</button>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => commando.dispatch(inc.create({}))}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
