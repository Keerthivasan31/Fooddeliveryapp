import React from 'react';
import './index.css';

const apps = [
  ['Customer', import.meta.env.VITE_CUSTOMER_APP_URL || 'http://localhost:9001', 'Browse restaurants, order food, pay in TEST mode and track delivery.'],
  ['Restaurant', import.meta.env.VITE_RESTAURANT_APP_URL || 'http://localhost:9002', 'Manage restaurant orders and menu operations.'],
  ['Delivery', import.meta.env.VITE_DELIVERY_APP_URL || 'http://localhost:9003', 'Manage deliveries and publish live location updates.'],
  ['Admin', import.meta.env.VITE_ADMIN_APP_URL || 'http://localhost:9004', 'Platform administration and catalog management.'],
];

export default function App() {
  return <div className="page"><div className="auth-card">
    <div className="brand">🍔 Food Delivery Platform</div>
    <h1>Choose your portal</h1>
    <p className="subtitle">Each application has its own login page. Credentials are verified by the shared authentication API; tokens are never passed between applications in URL query strings.</p>
    <div style={{display:'grid',gap:12}}>{apps.map(([name,url,desc]) =>
      <a key={name} href={url} style={{display:'block',padding:16,border:'1px solid #e5dfd3',borderRadius:14,textDecoration:'none',color:'inherit'}}>
        <strong>{name}</strong><div style={{fontSize:13,opacity:.72,marginTop:4}}>{desc}</div>
      </a>)}
    </div>
  </div></div>;
}
