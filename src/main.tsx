import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Yorum satırını kaldırdık ve projeye dahil ettik

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);