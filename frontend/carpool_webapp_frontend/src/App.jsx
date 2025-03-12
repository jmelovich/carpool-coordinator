import { useState } from 'react';
import './App.css';
import Login from './Login';
import Register from './Register';

function App() {
  const [view, setView] = useState(null);

  return (
    <div className="App">
      <h1 className="text-4xl font-bold text-[#2A9D8F] mb-6 font-sans">
        Welcome to Carpool Coordinator!
      </h1>

      <div className="space-x-4 mb-6">
        <button
          className="px-4 py-2 bg-[#228B22] text-white rounded-lg hover:bg-[#1c6e1c]"
          onClick={() => setView('signup')}
        >
          Sign Up
        </button>
        <button
          className="px-4 py-2 bg-[#87CEEB] text-[#333333] rounded-lg hover:bg-[#6bb5d8]"
          onClick={() => setView('login')}
        >
          Log In
        </button>
      </div>

      {view === 'signup' && <Register />}
      {view === 'login' && <Login />}
    </div>
  );
}

export default App;