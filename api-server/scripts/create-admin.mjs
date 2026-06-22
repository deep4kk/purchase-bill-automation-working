import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB || 'purchase_bill_automation';
const email = process.argv[2] || 'admin@example.com';
const password = process.argv[3] || 'admin123';
const name = process.argv[4] || 'Admin User';

const client = new MongoClient(uri);

try {
  await client.connect();

  const db = client.db(dbName);
  const hash = await bcrypt.hash(password, 10);

  const result = await db.collection('users').insertOne({
    name,
    email,
    passwordHash: hash,
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log('User created!', result.insertedId.toString());
} catch (error) {
  console.error('Failed to create user:', error);
  process.exit(1);
} finally {
  await client.close();
}
