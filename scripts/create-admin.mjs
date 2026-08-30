// One-time seed script: creates the admin (librarian) Firebase Auth account.
// Usage: node scripts/create-admin.mjs [email] [password]
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDtgqP1FVxmQDV0LvzCwl0lFuXk9QRaS9U",
  authDomain: "lms-b36e9.firebaseapp.com",
  projectId: "lms-b36e9",
  storageBucket: "lms-b36e9.firebasestorage.app",
  messagingSenderId: "838217665420",
  appId: "1:838217665420:web:768bf3c9519a5fb27864a9",
};

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log("Usage: node scripts/create-admin.mjs <email> <password>");
  console.log("Creates (or verifies) a librarian account in Firebase Auth.");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

try {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  console.log("CREATED  uid=" + cred.user.uid);
  console.log("email:    " + email);
  console.log("password: " + password);
} catch (e) {
  if (e.code === "auth/email-already-in-use") {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      console.log("ALREADY EXISTS and this password works. uid=" + cred.user.uid);
      console.log("email:    " + email);
      console.log("password: " + password);
    } catch {
      console.log("ALREADY EXISTS but the password is different.");
      console.log("Reset it in Firebase Console > Authentication > Users, or use another email.");
    }
  } else {
    console.log("FAILED: " + e.code + " — " + e.message);
  }
}
process.exit(0);
