const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  hostTeamName: { type: String, required: true },
  hostCaptainId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Links to the User who created it
  sport: { type: String, required: true },
  turfId: { type: String, required: true },
  date: { type: String, required: true },
  timeSlot: { type: Number, required: true },
  
  // When another team accepts, their details go here
  challengerTeamName: { type: String, default: null },
  challengerCaptainId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  status: { type: String, enum: ['Open', 'Accepted', 'Completed', 'Cancelled'], default: 'Open' }
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);