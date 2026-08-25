import { logout, useAppAuth } from './auth.js';
import AuthPage from './AuthPage.jsx';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const ORDER_SERVICE_URL = import.meta.env.VITE_ORDER_SERVICE_URL || 'http://localhost:4000';
const TRACKING_SERVICE_URL = import.meta.env.VITE_TRACKING_SERVICE_URL || 'http://localhost:4002';

function DeliveryDashboard() {
  useAppAuth();
  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  const fetchDeliverableOrders = async () => {
    try {
      const { data } = await axios.get(`${ORDER_SERVICE_URL}/api/orders`, {
        params: { status: 'OUT_FOR_DELIVERY' }
      });
      setOrders(data);
    } catch (err) {
      console.error('Unable to load delivery orders', err);
    }
  };

  useEffect(() => {
    fetchDeliverableOrders();
    const interval = setInterval(fetchDeliverableOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socketRef.current = io(TRACKING_SERVICE_URL, { transports: ['websocket', 'polling'] });
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      socketRef.current?.disconnect();
    };
  }, []);

  const stopSharing = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (activeOrderId) {
      socketRef.current?.emit('location:stop', { orderId: activeOrderId });
    }
    setSharing(false);
  };

  const startSharing = () => {
    if (!activeOrderId) return;
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser.');
      return;
    }

    if (!socketRef.current) {
      setLocationError('Tracking connection is not ready. Please try again.');
      return;
    }

    socketRef.current.emit('location:start', { orderId: activeOrderId });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        setLocation(next);
        setSharing(true);
        socketRef.current?.emit('location:update', {
          orderId: activeOrderId,
          ...next
        });
        setLocationError('');
      },
      (error) => {
        const messages = {
          1: 'Location permission was denied. Allow location access in the browser and try again.',
          2: 'Your location is currently unavailable. Please try again.',
          3: 'Location request timed out. Please try again.'
        };
        setLocationError(messages[error.code] || 'Unable to read your location.');
        setSharing(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000
      }
    );
  };

  const selectOrder = (orderId) => {
    if (activeOrderId && activeOrderId !== orderId) stopSharing();
    setActiveOrderId(orderId);
    setLocation(null);
    setLocationError('');
  };

  const markDelivered = async (orderId) => {
    try {
      stopSharing();
      await axios.patch(`${ORDER_SERVICE_URL}/api/orders/${orderId}/status`, { status: 'DELIVERED' });
      setActiveOrderId(null);
      setLocation(null);
      fetchDeliverableOrders();
    } catch (err) {
      alert('Failed to mark delivered: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="container">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
        <span>Signed in as <strong>Delivery Partner</strong></span>
        <button onClick={logout}>Logout</button>
      </div>

      <h1>🛵 LoyalEats • Delivery Partner</h1>
      <div className="card">
        <h3>Live GPS sharing</h3>
        <p>
          When you start sharing, your browser's real GPS location is sent automatically
          to the customer's live order-tracking map.
        </p>
        <p><strong>Tip:</strong> Use <code>http://localhost:9003</code> during local testing and allow browser location permission.</p>
      </div>

      {orders.length === 0 && <div className="card">No orders ready for pickup right now.</div>}

      {orders.map((order) => (
        <div key={order.id} className="card">
          <h3>Order #{order.id.slice(0, 8).toUpperCase()}</h3>
          <p>Deliver to: {order.delivery_address}</p>
          <p>Total: ${Number(order.total_amount).toFixed(2)}</p>

          {activeOrderId === order.id ? (
            <>
              <p style={{ color: sharing ? '#227a55' : '#77736b', fontWeight: 700 }}>
                {sharing ? '● Live location sharing is ON' : 'Trip accepted — location sharing is OFF'}
              </p>
              {location && (
                <p style={{fontSize:12}}>
                  GPS: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                  {location.accuracy ? ` · ±${Math.round(location.accuracy)} m` : ''}
                </p>
              )}
              {locationError && <div className="location-error">{locationError}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!sharing ? (
                  <button onClick={startSharing}>📍 Start sharing location</button>
                ) : (
                  <button onClick={stopSharing}>Pause sharing</button>
                )}
                <button style={{ background: '#227a55' }} onClick={() => markDelivered(order.id)}>
                  Mark Delivered
                </button>
              </div>
            </>
          ) : (
            <button onClick={() => selectOrder(order.id)}>Accept Delivery</button>
          )}
        </div>
      ))}
    </div>
  );
}

function App() {
  return <BrowserRouter>
    <Routes>
      <Route path="/login" element={<AuthPage/>}/>
      <Route path="/register" element={<AuthPage/>}/>
      <Route path="*" element={<DeliveryDashboard/>}/>
    </Routes>
  </BrowserRouter>;
}
export default App;
