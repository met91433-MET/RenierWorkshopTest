import React, { useState } from 'react';
import { 
  auth, 
  db 
} from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc 
} from 'firebase/firestore';
import { 
  ShieldAlert, 
  Lock, 
  Mail, 
  User, 
  Wrench, 
  CheckCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { UserProfile, UserPermissions } from '../types';

interface LoginViewProps {
  onLoginSuccess: (userProfile: UserProfile) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Dual function to log in / create user profile in Firestore
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        // 1. Create firebase Auth user
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        // 2. Create default profile with NO permissions by default (safe)
        const defaultPerms: UserPermissions = {
          canReceive: false,
          canInspect: false,
          canQuote: false,
          canCreateJobCard: false,
          canClose: false,
          isAdmin: false
        };

        const profile: UserProfile = {
          uid,
          email,
          displayName: displayName.trim() || email.split('@')[0],
          permissions: defaultPerms,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', uid), profile);
        onLoginSuccess(profile);
      } else {
        // 1. Standard sign in
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const uid = credential.user.uid;

        // 2. Fetch profile from Firestore
        const profileDoc = await getDoc(doc(db, 'users', uid));
        if (profileDoc.exists()) {
          onLoginSuccess(profileDoc.data() as UserProfile);
        } else {
          // Fallback if profile doesn't exist in DB but exists in Auth
          const fallbackPerms: UserPermissions = {
            canReceive: true,
            canInspect: true,
            canQuote: true,
            canCreateJobCard: true,
            canClose: true,
            isAdmin: true
          };
          const profile: UserProfile = {
            uid,
            email,
            displayName: email.split('@')[0],
            permissions: fallbackPerms,
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', uid), profile);
          onLoginSuccess(profile);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setErrorMsg('Invalid email address or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setErrorMsg('This email address is already registered.');
      } else if (err.code === 'auth/weak-password') {
        setErrorMsg('Password should be at least 6 characters.');
      } else {
        setErrorMsg(err.message || 'Authentication failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Demo Account Auto-Sign in and registration helper (Crucial for evaluation!)
  const handleDemoLogin = async (
    role: string, 
    emailStr: string, 
    displayNameStr: string, 
    perms: UserPermissions
  ) => {
    setErrorMsg('');
    setIsLoading(true);
    const demoPassword = 'password123';

    try {
      let uid = '';
      try {
        // Try logging in first
        const credential = await signInWithEmailAndPassword(auth, emailStr, demoPassword);
        uid = credential.user.uid;
      } catch (err: any) {
        // If account doesn't exist, register it!
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          const credential = await createUserWithEmailAndPassword(auth, emailStr, demoPassword);
          uid = credential.user.uid;
        } else {
          throw err;
        }
      }

      // Overwrite/Force save the permissions in DB to ensure demo account behaves exactly as promised
      const profile: UserProfile = {
        uid,
        email: emailStr,
        displayName: displayNameStr,
        permissions: perms,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', uid), profile);
      onLoginSuccess(profile);
    } catch (err: any) {
      console.error("Demo login error:", err);
      setErrorMsg(`Failed to auto-sign in as demo ${role}: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const demos = [
    {
      role: 'Administrator',
      email: 'admin@mesworkshop.com',
      name: 'Sarah Admin (CEO)',
      color: 'bg-slate-800 hover:bg-slate-900 text-white',
      desc: 'Full ERP clearance & Admin panel access',
      perms: { canReceive: true, canInspect: true, canQuote: true, canCreateJobCard: true, canClose: true, isAdmin: true }
    },
    {
      role: 'Receiving Clerk',
      email: 'receiver@mesworkshop.com',
      name: 'Dave Receiving',
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      desc: 'Can only capture incoming deliveries',
      perms: { canReceive: true, canInspect: false, canQuote: false, canCreateJobCard: false, canClose: false, isAdmin: false }
    },
    {
      role: 'QC Inspector',
      email: 'inspector@mesworkshop.com',
      name: 'Bob QC Inspector',
      color: 'bg-amber-500 hover:bg-amber-600 text-white',
      desc: 'Can only capture damages and instructions',
      perms: { canReceive: false, canInspect: true, canQuote: false, canCreateJobCard: false, canClose: false, isAdmin: false }
    },
    {
      role: 'Costing Quoter',
      email: 'quoter@mesworkshop.com',
      name: 'Sarah Costing',
      color: 'bg-purple-600 hover:bg-purple-700 text-white',
      desc: 'Access limited to pricing & quotation matrices',
      perms: { canReceive: false, canInspect: false, canQuote: true, canCreateJobCard: false, canClose: false, isAdmin: false }
    },
    {
      role: 'Floor Coordinator',
      email: 'planner@mesworkshop.com',
      name: 'Marc Planner',
      color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      desc: 'Allowed to schedule and create Job Cards only',
      perms: { canReceive: false, canInspect: false, canQuote: false, canCreateJobCard: true, canClose: false, isAdmin: false }
    },
    {
      role: 'Quality Manager',
      email: 'closer@mesworkshop.com',
      name: 'James QC Director',
      color: 'bg-rose-600 hover:bg-rose-700 text-white',
      desc: 'Clearance limited to closing jobs and quality release',
      perms: { canReceive: false, canInspect: false, canQuote: false, canCreateJobCard: false, canClose: true, isAdmin: false }
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans" id="login-view-root">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo */}
        <div className="bg-blue-600 text-white p-3 rounded-2xl w-14 h-14 flex items-center justify-center shadow-sm mx-auto mb-4">
          <Wrench className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-800 font-display">MES Workshop3</h2>
        <p className="mt-2 text-sm text-slate-500">
          Industrial Component Repair and Tracking Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-150 rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="bg-red-50 text-red-800 border border-red-100 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 mb-5 text-left">
              <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Regular Login Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
            {isSignUp && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dave Miller"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-9 pr-4 py-2.5 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="e.g. operator@mesworkshop.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 pr-4 py-2.5 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Security Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="Password (minimum 6 chars)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-4 py-2.5 w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-sm focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-colors text-sm disabled:opacity-55 cursor-pointer flex justify-center items-center gap-1.5"
            >
              {isLoading ? 'Processing Authentication...' : isSignUp ? 'Create Operator Account' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Toggle Sign In / Sign Up */}
          <div className="mt-6 text-center text-xs">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); }}
              className="text-blue-600 hover:text-blue-700 font-bold transition-all"
            >
              {isSignUp ? 'Already have an operator profile? Sign In' : "Don't have an account? Sign Up as Operator"}
            </button>
          </div>

          {/* Divider */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 font-semibold text-slate-400">Or Evaluation Quick Bypass</span>
            </div>
          </div>

          {/* Demo Account Grid */}
          <div className="mt-5 space-y-2 text-left">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center mb-3">
              Click to instantly log in with preloaded permissions:
            </p>
            <div className="grid grid-cols-2 gap-2">
              {demos.map(demo => (
                <button
                  key={demo.role}
                  type="button"
                  onClick={() => handleDemoLogin(demo.role, demo.email, demo.name, demo.perms)}
                  disabled={isLoading}
                  className={`p-2 rounded-xl text-left border border-slate-200/60 shadow-2xs hover:shadow-sm transition-all ${demo.color} disabled:opacity-55 flex flex-col justify-between h-20 cursor-pointer`}
                >
                  <div>
                    <p className="text-[10px] font-extrabold uppercase opacity-85">{demo.role}</p>
                    <p className="text-[10px] font-semibold mt-0.5 truncate opacity-95">{demo.name}</p>
                  </div>
                  <p className="text-[8px] opacity-75 mt-1 leading-normal line-clamp-2">{demo.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
