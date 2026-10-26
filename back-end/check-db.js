import 'dotenv/config'
import mongoose from 'mongoose'

async function checkDatabase() {
  if (!process.env.MONGODB_URI) {
    console.error('Add MONGODB_URI to your back-end/.env file.')
    process.exitCode = 1
    return
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    })

    await mongoose.connection.db.admin().ping()
    console.log('Successfully connected to MongoDB Atlas.')
  } catch {
    console.error(
      'Could not connect. Check your connection string and Atlas network access.'
    )
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

checkDatabase()