const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBRBDTIHCdHRs9ItcJrfa6j7QpXJXneusQ",
  authDomain: "washwheels-cfad7.firebaseapp.com",
  projectId: "washwheels-cfad7",
  storageBucket: "washwheels-cfad7.firebasestorage.app",
  messagingSenderId: "743893561312",
  appId: "1:743893561312:web:ff08ed88a2f23437edc585"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log("Fetching...");
  const start = Date.now();
  try {
    const snap = await getDoc(doc(db, 'roles', 'subrattrivedi3@gmail.com'));
    console.log("Success! Exists:", snap.exists(), "Data:", snap.data());
  } catch(e) {
    console.error("Error:", e.message);
  }
  console.log("Took", Date.now() - start, "ms");
  process.exit(0);
}
test();
