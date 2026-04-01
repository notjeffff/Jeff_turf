const mongoose = require('mongoose');

// This defines exactly what a "Team Opening" looks like in the database
const openingSchema = new mongoose.Schema({
  turfId: { type: String, required: true }, // Which turf they are playing at
  sport: { type: String, required: true }, // Football, Cricket, etc.
  totalTeamSize: { type: Number, required: true }, 
  openSeats: { type: Number, required: true },
  farePerPerson: { type: Number, required: true },
  
  // This is the array of solo players who want to join!
  joinRequests: [{
    playerName: String,
    playerPhone: String,
    status: { type: String, default: 'Pending' } // Pending, Accepted, or Rejected
  }],
  
  // Automatically records when this opening was created
  createdAt: { type: Date, default: Date.now } 
});

// Export it so our server can use it
module.exports = mongoose.model('Opening', openingSchema);