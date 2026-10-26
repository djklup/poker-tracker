/**
 * Poker Tracker - Firebase Configuration Module
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your actual Firebase config credentials
const firebaseConfig = {
  apiKey: "AIzaSyDlPrrQt1qJh8hefVhdQaVyYPR6t9LS8wI",
  authDomain: "poker-tracker-29f10.firebaseapp.com",
  projectId: "poker-tracker-29f10",
  storageBucket: "poker-tracker-29f10.firebasestorage.app",
  messagingSenderId: "540593278406",
  appId: "1:540593278406:web:789457710ddb9f4b0736c7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Assign to window immediately so it is available globally
window.FirebaseServices = {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
};

// Flag that it's loaded
window.isFirebaseLoaded = true;
