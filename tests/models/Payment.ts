import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  payer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  method: { type: String, enum: ['cash', 'card', 'upi', 'bank_transfer'], required: true },
  transactionId: { type: String, unique: true },
  status: { type: String, enum: ['initiated', 'processing', 'completed', 'failed', 'refunded'], default: 'initiated' },
  processedAt: Date,
  fees: { type: Number, default: 0 },
  description: String,
  metadata: { type: Map, of: String },
});

paymentSchema.index({ payer: 1, processedAt: -1 });
paymentSchema.index({ transactionId: 1 }, { unique: true, name: 'txn_unique_idx' });

export const Payment = mongoose.model('Payment', paymentSchema);
