import React, {useState} from "react";
import axios from "axios";
import {useNavigate} from "react-router-dom";

const AUTH_API = import.meta.env.VITE_AUTH_API_URL || "http://localhost:4003";
const EXPECTED_ROLE = "DELIVERY";

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode,setMode] = useState(window.location.pathname === "/register" && EXPECTED_ROLE !== "ADMIN" ? "register" : "login");
  const [form,setForm] = useState({name:"",email:"",password:"",mobile:""});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if(mode==="register") {
        await axios.post(`${AUTH_API}/api/auth/register`, {
          name:form.name, email:form.email, password:form.password,
          mobile:form.mobile, role:EXPECTED_ROLE
        });
        setMessage("Registration successful. Please login.");
        setMode("login");
        setForm(f=>({...f,password:""}));
        return;
      }
      const {data} = await axios.post(`${AUTH_API}/api/auth/login`, {email:form.email,password:form.password});
      if(data.user?.role !== EXPECTED_ROLE) throw new Error(`This account is not a ${EXPECTED_ROLE.toLowerCase()} account.`);
      localStorage.setItem("food_delivery_token",data.token);
      localStorage.setItem("food_delivery_user",JSON.stringify(data.user));
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      navigate(returnTo && returnTo.startsWith("/") ? returnTo : "/",{replace:true});
    } catch(err) {
      setError(err.response?.data?.error || err.message || "Authentication failed");
    } finally { setBusy(false); }
  };

  return <div style={styles.page}>
    <div style={styles.card}>
      <div style={styles.logo}>🛵</div>
      <div style={styles.eyebrow}>DELIVERY PORTAL</div>
      <h1 style={styles.h1}>{mode==="login"?"Welcome back":"Create account"}</h1>
      <p style={styles.sub}>{mode==="login"?"Login to continue to your application.":"Create a delivery partner account."}</p>
      {message && <div style={{...styles.alert,borderColor:"#227a55",color:"#227a55"}}>{message}</div>}
      {error && <div style={{...styles.alert,borderColor:"#a4473f",color:"#a4473f"}}>{error}</div>}
      <form onSubmit={submit} style={{display:"grid",gap:12}}>

        {mode==="register" && <>
          <input required placeholder="Full name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={styles.input}/>
          <input placeholder="Mobile number" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} style={styles.input}/>
        </>}
    
        <input required type="email" placeholder="Email address" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} style={styles.input}/>
        <input required minLength="6" type="password" placeholder="Password (minimum 6 characters)" autoComplete={mode==="login"?"current-password":"new-password"} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} style={styles.input}/>
        <button disabled={busy} style={{...styles.button,opacity:busy?.7:1}}>{busy?"Please wait…":mode==="login"?"Login":"Register"}</button>
      </form>
<button className="auth-switch" type="button" onClick={()=>{const next=mode==="login"?"register":"login";setMode(next);setError("");setMessage("");}}>{mode==="login"?"New user? Create an account":"Already registered? Login"}</button>
      <div style={styles.footer}>Food Delivery Platform · DELIVERY</div>
    </div>
  </div>;
}

const styles={
  page:{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"radial-gradient(circle at 15% 10%,#e5c77d55,transparent 30%),linear-gradient(135deg,#f7f3ea,#eeeaf8)",fontFamily:"Arial,sans-serif"},
  card:{width:"100%",maxWidth:440,padding:34,borderRadius:24,background:"#ffffffee",boxShadow:"0 24px 70px #17142f22",border:"1px solid #e8e1d5"},
  logo:{fontSize:42,marginBottom:8},
  eyebrow:{fontSize:12,fontWeight:800,letterSpacing:2,color:"#9b7738"},
  h1:{fontSize:34,margin:"8px 0"},
  sub:{color:"#77736b",lineHeight:1.5,marginBottom:22},
  input:{width:"100%",padding:"13px 14px",border:"1px solid #ddd5c7",borderRadius:12,fontSize:15,outline:"none",boxSizing:"border-box"},
  button:{width:"100%",padding:14,border:0,borderRadius:12,background:"#17142f",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer"},
  alert:{padding:11,border:"1px solid",borderRadius:10,marginBottom:14,background:"#fff"},
  authSwitch:{width:"100%",marginTop:14,padding:12,border:0,background:"transparent",color:"#29234f",fontWeight:700,cursor:"pointer"},
  footer:{marginTop:20,textAlign:"center",fontSize:12,color:"#999"}
};
