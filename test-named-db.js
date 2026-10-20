const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBRBDTIHCdHRs9ItcJrfa6j7QpXJXneusQ",
  authDomain: "washwheels-cfad7.firebaseapp.com",
  projectId: "washwheels-cfad7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "default"); // Initialize with the explicit name "default"

async function test() {
  try {
    console.log("Fetching from named database 'default'...");
    const snap = await getDoc(doc(db, 'roles', 'subrattrivedi3@gmail.com'));
    console.log("Success! Exists:", snap.exists(), "Data:", snap.data());
  } catch(e) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}
test();
