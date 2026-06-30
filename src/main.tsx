import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Eğer TailwindCSS veya global stilleriniz varsa buraya ekleyin.
// Örn: import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);