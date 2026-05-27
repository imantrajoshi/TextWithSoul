import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer = null;

const connectDB = async () => {
  try {
    let uri = process.env.MONGODB_URI;

    // If no external MongoDB is configured or connection fails, use in-memory
    if (!uri || uri.includes('localhost') || uri.includes('127.0.0.1')) {
      try {
        // Try connecting to external MongoDB first
        if (uri) {
          await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
          console.log(`✓ MongoDB connected: ${mongoose.connection.host}`);
          return;
        }
      } catch {
        console.log('⚠ External MongoDB not available, starting in-memory server...');
        await mongoose.disconnect();
      }

      // Fallback to in-memory MongoDB
      mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
      console.log('✓ In-memory MongoDB started');
    }

    await mongoose.connect(uri);
    console.log(`✓ MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`✗ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  process.exit(0);
});

export default connectDB;
