import { getAuthenticatedUser, logout, useAppAuth } from './auth.js';
import AuthPage from './AuthPage.jsx';
import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import './index.css';

const AUTH_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:4003';
const ORDER_SERVICE_URL = import.meta.env.VITE_ORDER_SERVICE_URL || 'http://localhost:4000';
const PAYMENT_SERVICE_URL = import.meta.env.VITE_PAYMENT_SERVICE_URL || 'http://localhost:4001';
const TRACKING_SERVICE_URL = import.meta.env.VITE_TRACKING_SERVICE_URL || 'http://localhost:4002';
const CATALOG_URL = import.meta.env.VITE_CATALOG_SERVICE_URL || 'http://localhost:4004';
const TOKEN_KEY = 'food_delivery_token';
const RESTAURANT_ID = import.meta.env.VITE_RESTAURANT_ID || '11111111-1111-1111-1111-111111111111';
const TEST_CARDS={success:'4242424242424242',declined:'4000000000000002',funds:'4000000000009995',error:'4000000000009987'};
const PAYMENT_SCENARIOS=[{key:'success',label:'Successful test payment',card:TEST_CARDS.success},{key:'declined',label:'Declined test card',card:TEST_CARDS.declined},{key:'funds',label:'Insufficient funds',card:TEST_CARDS.funds},{key:'error',label:'Processing error',card:TEST_CARDS.error}];
const authHeaders=()=>({Authorization:`Bearer ${localStorage.getItem(TOKEN_KEY)||''}`});
const api=axios.create(); api.interceptors.request.use(config=>({...config,headers:{...(config.headers||{}),...authHeaders()}}));
const fallbackImg='https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=700&q=80';
let googleMapsPromise;
function loadGoogleMaps() {
  const key = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (!key) return Promise.reject(new Error('Google Maps API key is not configured. Set VITE_GOOGLE_MAPS_API_KEY.'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      window.gm_authFailure = previousAuthFailure;
      fn(value);
    };
    const previousAuthFailure = window.gm_authFailure;
    window.gm_authFailure = () => {
      finish(reject, new Error(
        'Google Maps rejected this API key. Check that Maps JavaScript API is enabled, billing is active, and the key allows http://localhost:9001/*.'
      ));
      if (typeof previousAuthFailure === 'function') previousAuthFailure();
    };

    const existing = document.getElementById('google-maps-script');
    if (existing) {
      const onLoad = () => {
        if (window.google?.maps) finish(resolve, window.google.maps);
        else finish(reject, new Error('Google Maps loaded without the Maps JavaScript API.'));
      };
      const onError = () => finish(reject, new Error('Google Maps failed to load. Check the API key, Maps JavaScript API, billing, and HTTP referrer restrictions.'));
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) finish(resolve, window.google.maps);
      else finish(reject, new Error('Google Maps loaded without the Maps JavaScript API.'));
    };
    script.onerror = () => finish(reject, new Error('Google Maps failed to load. Check the API key, Maps JavaScript API, billing, and HTTP referrer restrictions.'));
    document.head.appendChild(script);
  }).catch((err) => {
    googleMapsPromise = null;
    throw err;
  });

  return googleMapsPromise;
}

function LiveTrackingMap({ location, history = [], height = 360 }) {
  const mapRef = React.useRef(null);
  const mapObjectRef = React.useRef(null);
  const markerRef = React.useRef(null);
  const polylineRef = React.useRef(null);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;
        const initial = location || { lat: 13.0827, lng: 80.2707 };
        mapObjectRef.current = new maps.Map(mapRef.current, {
          center: { lat: Number(initial.lat), lng: Number(initial.lng) },
          zoom: location ? 16 : 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        });
      })
      .catch((err) => {
        if (!cancelled) setMapError(err.message);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const maps = window.google?.maps;
    const map = mapObjectRef.current;
    if (!maps || !map || !location) return;

    const point = { lat: Number(location.lat), lng: Number(location.lng) };
    if (!markerRef.current) {
      markerRef.current = new maps.Marker({
        map,
        position: point,
        title: 'Delivery partner'
      });
    } else {
      markerRef.current.setPosition(point);
    }

    map.panTo(point);
    if (map.getZoom() < 15) map.setZoom(16);

    const points = [...history, location]
      .filter(Boolean)
      .map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));

    if (points.length > 1) {
      if (!polylineRef.current) {
        polylineRef.current = new maps.Polyline({
          map,
          path: points,
          geodesic: true,
          strokeOpacity: 0.8,
          strokeWeight: 4
        });
      } else {
        polylineRef.current.setPath(points);
      }
    }
  }, [location, history]);

  if (mapError) {
    return (
      <div className="map-placeholder" style={{height}}>
        <strong>Google Maps is not configured</strong>
        <span>{mapError}</span>
        {location && <small>Live GPS: {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}</small>}
      </div>
    );
  }

  return <div ref={mapRef} className="live-map" style={{height}} aria-label="Live delivery tracking map" />;
}

function TrackingCard({ order }) {
  const [location, setLocation] = useState(null);
  const [history, setHistory] = useState([]);
  const [trackingStarted, setTrackingStarted] = useState(false);
  const [open, setOpen] = useState(order.status === 'OUT_FOR_DELIVERY');

  useEffect(() => {
    if (!open) return undefined;
    const socket = io(TRACKING_SERVICE_URL, { transports: ['websocket', 'polling'] });
    socket.emit('order:subscribe', order.id);
    socket.on('tracking:started', () => setTrackingStarted(true));
    socket.on('tracking:stopped', () => setTrackingStarted(false));
    socket.on('location:changed', (next) => {
      setLocation(next);
      setHistory(prev => [...prev, next].slice(-200));
      setTrackingStarted(true);
    });
    socket.on('tracking:history', (items) => {
      setHistory(items || []);
      if (items?.length) {
        setLocation(items[items.length - 1]);
        setTrackingStarted(true);
      }
    });
    return () => socket.disconnect();
  }, [open, order.id]);

  return (
    <div className="tracking-panel">
      <div className="tracking-header">
        <div>
          <span className="eyebrow">LIVE DELIVERY TRACKING</span>
          <h3>Where is my order?</h3>
        </div>
        <button onClick={() => setOpen(v => !v)}>{open ? 'Hide map' : 'Track on Google Maps'}</button>
      </div>
      {open && (
        <>
          <div className="tracking-status">
            <span className={`tracking-dot ${location ? 'live' : ''}`}></span>
            {location
              ? `Delivery partner location updated ${new Date(location.updatedAt).toLocaleTimeString()}`
              : trackingStarted
                ? 'Delivery partner started sharing. Waiting for GPS…'
                : 'Waiting for the delivery partner to start sharing location.'}
          </div>
          <LiveTrackingMap location={location} history={history} />
          {location && (
            <p className="tracking-coordinates">
              📍 {Number(location.lat).toFixed(6)}, {Number(location.lng).toFixed(6)}
              {location.accuracy ? ` · accuracy ±${Math.round(location.accuracy)} m` : ''}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function formatCard(v){const d=v.replace(/\D/g,'').slice(0,16);return d.replace(/(.{4})/g,'$1 ').trim()}
function formatExpiry(v){const d=v.replace(/\D/g,'').slice(0,4);return d.length>2?`${d.slice(0,2)}/${d.slice(2)}`:d}

function Nav(){return <div className="app-nav"><Link to="/" className="nav-brand">🍔 LoyalEats</Link><div className="nav-links"><Link to="/">Home</Link><Link to="/orders">Orders</Link><Link to="/profile">Profile</Link><button onClick={logout}>Logout</button></div></div>}
function Shell({children}){return <div className="container"><Nav/>{children}</div>}

function Home({cart,setCart}){
 const [restaurants,setRestaurants]=useState([]); const [menu,setMenu]=useState([]); const [loading,setLoading]=useState(true);
 useEffect(()=>{Promise.all([axios.get(`${CATALOG_URL}/api/restaurants`),axios.get(`${CATALOG_URL}/api/menu`,{params:{restaurantId:RESTAURANT_ID}})]).then(([r,m])=>{setRestaurants(r.data);setMenu(m.data)}).finally(()=>setLoading(false))},[]);
 const add=item=>setCart(c=>({...c,[item.id]:{...item,quantity:(c[item.id]?.quantity||0)+1}}));
 const remove=item=>setCart(c=>{const n={...c};if(!n[item.id])return c;if(n[item.id].quantity>1)n[item.id]={...n[item.id],quantity:n[item.id].quantity-1};else delete n[item.id];return n});
 const total=Object.values(cart).reduce((s,i)=>s+Number(i.price)*i.quantity,0);
 const restaurant=restaurants.find(r=>r.id===RESTAURANT_ID);
 return <>
  <div className="brand-lockup"><div><span className="eyebrow">FOOD DELIVERY</span><h1>Order food you actually crave.</h1><p className="lead">Browse restaurants, see real food photos, and track every order.</p></div><span className="test-pill">● TEST MODE</span></div>
  <div className="card"><div className="section-heading"><div><span className="eyebrow">RESTAURANTS</span><h2>Explore nearby</h2></div><strong>{restaurants.length} restaurants</strong></div>
   {loading?<p>Loading restaurants…</p>:<div className="restaurant-grid">{restaurants.map(r=><Link className="restaurant-card" to={`/restaurant/${r.id}`} key={r.id}><img src={r.image_url||fallbackImg}/><div className="restaurant-copy"><h3>{r.name}</h3><p>{r.cuisine}</p><span>★ {r.rating} · {r.delivery_minutes}-{r.delivery_minutes+10} mins · {r.is_open?'Open':'Closed'}</span></div></Link>)}</div>}
  </div>
  {restaurant&&<div className="card"><div className="section-heading"><div><span className="eyebrow">{restaurant.name}</span><h2>Popular food</h2></div><Link className="text-link" to={`/restaurant/${restaurant.id}`}>View restaurant →</Link></div>
   <div className="food-grid">{menu.filter(x=>x.is_enabled).map(item=><div className="food-card" key={item.id}><img src={item.image_url||fallbackImg}/><div className="food-copy"><div><h3>{item.name}</h3><p>{item.description}</p></div><div className="food-bottom"><strong>${Number(item.price).toFixed(2)}</strong><button onClick={()=>add(item)}>Add</button></div></div></div>)}</div>
  </div>}
  <div className="card checkout-card"><div className="section-heading"><div><span className="eyebrow">CART</span><h2>{Object.keys(cart).length?`${Object.values(cart).reduce((s,i)=>s+i.quantity,0)} item(s) ready`:'Your cart is empty'}</h2></div><span className="cart-total">${total.toFixed(2)}</span></div>{Object.values(cart).map(i=><div className="menu-row" key={i.id}><div><strong>{i.name}</strong><span>${Number(i.price).toFixed(2)}</span></div><div className="quantity"><button onClick={()=>remove(i)}>-</button><span>{i.quantity}</span><button onClick={()=>add(i)}>+</button></div></div>)}<Link className={`button-link ${!total?'disabled':''}`} to={total?'/checkout':'#'}>Continue to checkout</Link></div>
 </>
}

function RestaurantDetail({cart,setCart}){const {id}=useParams();const [r,setR]=useState(null),[menu,setMenu]=useState([]);const add=i=>setCart(c=>({...c,[i.id]:{...i,quantity:(c[i.id]?.quantity||0)+1}}));useEffect(()=>{Promise.all([axios.get(`${CATALOG_URL}/api/restaurants/${id}`),axios.get(`${CATALOG_URL}/api/menu`,{params:{restaurantId:id}})]).then(([a,b])=>{setR(a.data);setMenu(b.data)})},[id]);if(!r)return <div className="card"><p>Loading restaurant…</p></div>;return <><Link className="back-link" to="/">← Back to restaurants</Link><div className="hero-restaurant card"><img src={r.image_url||fallbackImg}/><div><span className="eyebrow">RESTAURANT</span><h1>{r.name}</h1><p>{r.cuisine}</p><p>★ {r.rating} · {r.delivery_minutes}-{r.delivery_minutes+10} mins · {r.is_open?'Open now':'Closed'}</p><p>{r.address}</p></div></div><div className="card"><div className="section-heading"><div><span className="eyebrow">MENU</span><h2>All available food</h2></div></div><div className="food-grid">{menu.filter(i=>i.is_enabled).map(i=><div className="food-card" key={i.id}><img src={i.image_url||fallbackImg}/><div className="food-copy"><h3>{i.name}</h3><p>{i.description}</p><div className="food-bottom"><strong>${Number(i.price).toFixed(2)}</strong><button onClick={()=>add(i)}>Add to cart</button></div></div></div>)}</div></div></>}

function Checkout({cart,setCart}){const navigate=useNavigate();const [address,setAddress]=useState('');const [order,setOrder]=useState(null);const [payment,setPayment]=useState(null);const [tracking,setTracking]=useState(null);const [stage,setStage]=useState('checkout');const [error,setError]=useState('');const [placing,setPlacing]=useState(false);const [cardNumber,setCardNumber]=useState(TEST_CARDS.success),[expiry,setExpiry]=useState('12/30'),[cvv,setCvv]=useState('123'),[name,setName]=useState('Test Customer');const total=Object.values(cart).reduce((s,i)=>s+Number(i.price)*i.quantity,0);useEffect(()=>{api.get('/api/users/me').then(r=>{if(r.data.addresses?.length)setAddress(r.data.addresses[0].label||r.data.addresses[0].address||'')}).catch(()=>{})},[]);useEffect(()=>{if(!order)return;const timer=setInterval(()=>axios.get(`${ORDER_SERVICE_URL}/api/orders/${order.id}`).then(r=>setOrder(r.data)).catch(()=>{}),4000);return()=>clearInterval(timer)},[order?.id]);useEffect(()=>{if(!order)return;const socket=io(TRACKING_SERVICE_URL);socket.emit('order:subscribe',order.id);socket.on('location:changed',setTracking);return()=>socket.disconnect()},[order?.id]);
 const pay=async()=>{if(!total||placing)return;const user=getAuthenticatedUser();if(!user)return logout();setPlacing(true);setError('');setStage('creating');try{const items=Object.values(cart).map(i=>({menuItemId:i.id,name:i.name,quantity:i.quantity,price:Number(i.price),imageUrl:i.image_url||null}));const {data:o}=await axios.post(`${ORDER_SERVICE_URL}/api/orders`,{customerId:user.id,restaurantId:RESTAURANT_ID,items,totalAmount:Number(total.toFixed(2)),deliveryAddress:address.trim()});setOrder(o);setStage('processing');const {data:intent}=await axios.post(`${PAYMENT_SERVICE_URL}/api/payments/intents`,{orderId:o.id,amount:Number(total.toFixed(2)),currency:'USD',cardNumber:cardNumber.replace(/\s/g,''),expiry,cvv,cardholderName:name},{headers:{'Idempotency-Key':`demo-${o.id}-${Date.now()}`}});const {data:result}=await axios.post(`${PAYMENT_SERVICE_URL}/api/payments/${intent.id}/confirm`);setPayment(result);if(result.status==='SUCCEEDED'){setCart({});setStage('success')}else{setError(result.message||'Payment declined');setStage('failed')}}catch(e){setError(e.response?.data?.error||e.message);setStage('failed')}finally{setPlacing(false)}};
 return <><Link className="back-link" to="/">← Back to menu</Link><div className="card"><span className="eyebrow">CHECKOUT</span><h2>Secure test checkout</h2><label>Delivery address</label><input value={address} onChange={e=>setAddress(e.target.value)} placeholder="Add delivery address"/><div className="payment-notice"><strong>Test environment</strong><span>No real payment is processed.</span></div><label>Payment scenario</label><select onChange={e=>setCardNumber(TEST_CARDS[e.target.value])} defaultValue="success">{PAYMENT_SCENARIOS.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select><div className="payment-grid"><div className="field-wide"><label>Card number</label><input value={formatCard(cardNumber)} onChange={e=>setCardNumber(e.target.value)} /></div><div><label>Expiry</label><input value={expiry} onChange={e=>setExpiry(formatExpiry(e.target.value))}/></div><div><label>CVV</label><input value={cvv} onChange={e=>setCvv(e.target.value.replace(/\D/g,'').slice(0,3))}/></div></div><label>Cardholder name</label><input value={name} onChange={e=>setName(e.target.value)}/><div className="checkout-footer"><strong>${total.toFixed(2)}</strong><button disabled={!total||placing} onClick={pay}>{placing?'Processing…':`Pay $${total.toFixed(2)}`}</button></div>{stage==='processing'&&<div className="processing-box"><div className="spinner"/><div>Processing test payment…</div></div>}{stage==='failed'&&<div className="error-box"><div className="result-icon">!</div><div><strong>Payment failed</strong><p>{error}</p></div></div>}{stage==='success'&&<div className="success-box"><div className="result-icon">✓</div><div><strong>Order placed successfully</strong><p>{payment?.transactionId||'TEST-TXN'}</p></div></div>}</div>{order&&stage==='success'&&<div className="card"><h2>Delivery tracking</h2><p>Status: <span className={`badge badge-${order.status.toLowerCase()}`}>{order.status}</span></p><TrackingCard order={order}/><button onClick={()=>navigate('/orders')}>View my orders</button></div>}</>}

function Orders(){
 const user=getAuthenticatedUser();
 const [orders,setOrders]=useState([]);
 useEffect(()=>{
   if(!user?.id)return;
   const load=()=>axios.get(`${ORDER_SERVICE_URL}/api/orders`,{params:{customerId:user.id}}).then(r=>setOrders(r.data)).catch(()=>{});
   load();
   const timer=setInterval(load,5000);
   return()=>clearInterval(timer);
 },[]);
 return <>
  <div className="section-title"><span className="eyebrow">ORDER HISTORY</span><h1>Your orders</h1></div>
  {!orders.length?<div className="card"><p>No orders yet. <Link to="/">Start ordering</Link>.</p></div>:
   orders.map(o=><div className="card order-card" key={o.id}>
    <div className="section-heading">
      <div><h3>Order #{o.id.slice(0,8).toUpperCase()}</h3><p>{new Date(o.created_at).toLocaleString()}</p></div>
      <span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span>
    </div>
    <div className="order-items">{(o.items||[]).map((i,idx)=><div key={idx} className="order-item"><img src={i.imageUrl||fallbackImg}/><div><strong>{i.quantity} × {i.name}</strong><span>${(Number(i.price)*i.quantity).toFixed(2)}</span></div></div>)}</div>
    <div className="order-summary"><span>Total</span><strong>${Number(o.total_amount).toFixed(2)}</strong><span>Payment</span><strong>{o.payment_status}</strong><span>Delivery</span><strong>{o.delivery_address}</strong></div>
    {['OUT_FOR_DELIVERY','DELIVERED'].includes(o.status) && <TrackingCard order={o}/>}
   </div>)
  }
 </>
}

function Profile(){const [p,setP]=useState(null);const [passwords,setPasswords]=useState({currentPassword:'',newPassword:''});const [form,setForm]=useState({name:'',email:'',mobile:''});const [newAddress,setNewAddress]=useState('');const [message,setMessage]=useState('');useEffect(()=>{api.get('/api/users/me').then(r=>{setP(r.data);setForm({name:r.data.name||'',email:r.data.email||'',mobile:r.data.mobile||''})})},[]);if(!p)return <div className="card"><p>Loading profile…</p></div>;const save=async()=>{const {data}=await api.patch('/api/users/me',{...form,addresses:p.addresses||[]});setP(data);setMessage('Profile updated.');localStorage.setItem('food_delivery_user',JSON.stringify({...JSON.parse(localStorage.getItem('food_delivery_user')||'{}'),name:data.name,email:data.email}))};const addAddress=async()=>{if(!newAddress.trim())return;const addresses=[...(p.addresses||[]),{id:crypto.randomUUID(),label:`Address ${(p.addresses||[]).length+1}`,address:newAddress.trim()}];const {data}=await api.patch('/api/users/me',{addresses});setP(data);setNewAddress('')};const removeAddress=async(id)=>{const addresses=(p.addresses||[]).filter(a=>a.id!==id);const {data}=await api.patch('/api/users/me',{addresses});setP(data)};const changePassword=async()=>{try{const {data}=await api.post('/api/users/me/password',passwords);setMessage(data.message);setPasswords({currentPassword:'',newPassword:''})}catch(e){setMessage(e.response?.data?.error||e.message)}};const photo=async(e)=>{const f=e.target.files?.[0];if(!f)return;const fd=new FormData();fd.append('image',f);const {data}=await api.post('/api/users/me/photo',fd,{headers:{...authHeaders(),'Content-Type':'multipart/form-data'}});setP(x=>({...x,profile_photo:data.profile_photo}));setMessage('Profile photo updated.')};return <><div className="section-title"><span className="eyebrow">PROFILE MANAGEMENT</span><h1>Your account</h1></div><div className="card profile-card"><div className="profile-head"><div className="avatar">{p.profile_photo?<img src={p.profile_photo}/>:p.name?.[0]||'U'}</div><div><h2>{p.name}</h2><p>{p.email}</p><label className="upload-label">Upload profile photo<input type="file" accept="image/*" onChange={photo}/></label></div></div><div className="form-grid"><div><label>Name</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div><label>Mobile</label><input value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} placeholder="Mobile number"/></div></div><button onClick={save}>Save profile</button>{message&&<p className="success-text">{message}</p>}</div><div className="card"><span className="eyebrow">SECURITY</span><h2>Change password</h2><div className="form-grid"><input type="password" placeholder="Current password" value={passwords.currentPassword} onChange={e=>setPasswords({...passwords,currentPassword:e.target.value})}/><input type="password" placeholder="New password" value={passwords.newPassword} onChange={e=>setPasswords({...passwords,newPassword:e.target.value})}/></div><button onClick={changePassword}>Change password</button></div><div className="card"><div className="section-heading"><div><span className="eyebrow">SAVED ADDRESSES</span><h2>Delivery addresses</h2></div></div>{(p.addresses||[]).map(a=><div className="address-row" key={a.id}><div><strong>{a.label}</strong><p>{a.address}</p></div><button className="danger-btn" onClick={()=>removeAddress(a.id)}>Remove</button></div>)}<textarea value={newAddress} onChange={e=>setNewAddress(e.target.value)} placeholder="Add another delivery address"/><button onClick={addAddress}>Add address</button></div></>}

function AppRoutes(){useAppAuth();const [cart,setCart]=useState({});return <Routes><Route path="/login" element={<AuthPage/>}/><Route path="/register" element={<AuthPage/>}/><Route path="*" element={<ProtectedRoutes cart={cart} setCart={setCart}/>} /></Routes>}
function ProtectedRoutes({cart,setCart}){return <Shell><Routes><Route path="/" element={<Home cart={cart} setCart={setCart}/>}/><Route path="/checkout" element={<Checkout cart={cart} setCart={setCart}/>}/><Route path="/restaurant/:id" element={<RestaurantDetail cart={cart} setCart={setCart}/>}/><Route path="/orders" element={<Orders/>}/><Route path="/profile" element={<Profile/>}/><Route path="*" element={<Home cart={cart} setCart={setCart}/>}/></Routes></Shell>}


export default function App(){return <BrowserRouter><AppRoutes/></BrowserRouter>}
