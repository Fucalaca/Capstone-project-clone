/**
 * MelSpectrogram Processor for Emotion Detection
 * Based on training code: librosa.feature.melspectrogram
 * 
 * Parameters from training:
 * - SR = 22050
 * - N_MELS = 256
 * - MAX_LENGTH = 200
 * - hop_length = 512
 * - n_fft = 2048
 * - fmax = SR/2 = 11025
 */

class MelSpectrogramProcessor {
    constructor(sampleRate = 22050, n_mels = 256, max_length = 200) {
        this.sampleRate = sampleRate;
        this.n_mels = n_mels;
        this.max_length = max_length;
        this.hop_length = 512;
        this.n_fft = 2048;
        this.fmax = sampleRate / 2; // 11025 Hz
        this.mel_basis = null;
        
        console.log(`MelSpectrogram Processor initialized:`);
        console.log(`- Sample Rate: ${sampleRate} Hz`);
        console.log(`- Mel bands: ${n_mels}`);
        console.log(`- Max length: ${max_length} frames`);
        console.log(`- FFT size: ${this.n_fft}`);
        console.log(`- Hop length: ${this.hop_length}`);
    }
    
    /**
     * Main function: audio → mel spectrogram (as in training)
     * @param {Float32Array} audioData - Raw audio samples
     * @returns {Promise<number[][]>} Mel spectrogram ready for model [n_mels][max_length]
     */
    async compute(audioData) {
        try {
            // 1. Preprocessing (normalization)
            const processed = this.preprocessAudio(audioData);
            
            // 2. Compute STFT
            const stft = await this.computeSTFT(processed);
            
            // 3. Compute Mel spectrogram
            const melSpec = this.computeMelSpectrogram(stft);
            
            // 4. Convert to dB scale (as in librosa.power_to_db)
            const melSpecDb = this.powerToDb(melSpec);
            
            // 5. Pad or trim to max_length (as in training)
            const prepared = this.padOrTrim(melSpecDb);
            
            // 6. Transpose: [frames][n_mels] → [n_mels][frames] (as in training)
            const transposed = this.transpose(prepared);
            
            return transposed;
            
        } catch (error) {
            console.error('Error computing mel spectrogram:', error);
            throw error;
        }
    }
    
    /**
     * Audio preprocessing (as in training)
     */
    preprocessAudio(audioData) {
        // Normalize amplitude (max absolute value = 1)
        let maxVal = 0;
        for (let i = 0; i < audioData.length; i++) {
            const absVal = Math.abs(audioData[i]);
            if (absVal > maxVal) maxVal = absVal;
        }
        
        if (maxVal > 0) {
            const normalized = new Float32Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                normalized[i] = audioData[i] / maxVal;
            }
            return normalized;
        }
        
        return audioData;
    }
    
    /**
     * Compute STFT (Short-Time Fourier Transform)
     * Simplified implementation - in production use Web Audio API or library
     */
    async computeSTFT(audioData) {
        const frames = [];
        const frameSize = this.n_fft;
        const hopSize = this.hop_length;
        
        // Calculate number of frames
        const nFrames = Math.floor((audioData.length - frameSize) / hopSize) + 1;
        
        for (let i = 0; i < nFrames; i++) {
            const start = i * hopSize;
            const frame = audioData.slice(start, start + frameSize);
            
            // Apply Hann window (similar to Hamming in training)
            const windowed = this.applyWindow(frame);
            
            // Compute FFT magnitude
            const spectrum = this.computeFFTMagnitude(windowed);
            frames.push(spectrum);
        }
        
        return frames; // [n_frames][n_fft/2 + 1]
    }
    
    /**
     * Apply window function (Hann window)
     */
    applyWindow(frame) {
        const windowed = new Float32Array(frame.length);
        const N = frame.length;
        
        for (let i = 0; i < N; i++) {
            // Hann window: w(n) = 0.5 * (1 - cos(2πn/(N-1)))
            const window = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
            windowed[i] = frame[i] * window;
        }
        
        return windowed;
    }
    
    /**
     * Compute FFT magnitude (simplified)
     * In production, use a proper FFT library like FFT.js
     */
    computeFFTMagnitude(frame) {
        const N = frame.length;
        const spectrum = new Float32Array(N / 2 + 1);
        
        // Simple DFT (slow but works for demo)
        for (let k = 0; k <= N / 2; k++) {
            let real = 0;
            let imag = 0;
            
            for (let n = 0; n < N; n++) {
                const angle = 2 * Math.PI * k * n / N;
                real += frame[n] * Math.cos(angle);
                imag -= frame[n] * Math.sin(angle);
            }
            
            // Magnitude
            const magnitude = Math.sqrt(real * real + imag * imag) / N;
            spectrum[k] = magnitude * magnitude; // Power spectrum
        }
        
        return spectrum;
    }
    
    /**
     * Create Mel filter bank (as in librosa)
     */
    createMelFilterBank() {
        if (this.mel_basis) return this.mel_basis;
        
        const nFft = this.n_fft;
        const sampleRate = this.sampleRate;
        const nMel = this.n_mels;
        const fmax = this.fmax;
        
        // Convert frequencies to Mel scale
        const hertzToMel = (f) => 2595 * Math.log10(1 + f / 700);
        const melToHertz = (m) => 700 * (Math.pow(10, m / 2595) - 1);
        
        // Frequency bins of FFT
        const fftFreqs = [];
        for (let i = 0; i <= nFft / 2; i++) {
            fftFreqs.push(i * sampleRate / nFft);
        }
        
        // Mel frequencies (equally spaced in Mel scale)
        const minMel = hertzToMel(0);
        const maxMel = hertzToMel(fmax);
        const melPoints = [];
        
        for (let i = 0; i < nMel + 2; i++) {
            const mel = minMel + (maxMel - minMel) * i / (nMel + 1);
            melPoints.push(melToHertz(mel));
        }
        
        // Create triangular filters
        const filters = new Array(nMel);
        for (let i = 0; i < nMel; i++) {
            filters[i] = new Float32Array(fftFreqs.length);
            const [left, center, right] = [melPoints[i], melPoints[i + 1], melPoints[i + 2]];
            
            for (let j = 0; j < fftFreqs.length; j++) {
                const freq = fftFreqs[j];
                if (freq >= left && freq <= center) {
                    filters[i][j] = (freq - left) / (center - left);
                } else if (freq >= center && freq <= right) {
                    filters[i][j] = (right - freq) / (right - center);
                }
            }
        }
        
        this.mel_basis = filters;
        return filters;
    }
    
    /**
     * Compute Mel spectrogram from STFT
     */
    computeMelSpectrogram(stft) {
        const filters = this.createMelFilterBank();
        const nFrames = stft.length;
        const nMel = this.n_mels;
        
        const melSpec = new Array(nFrames);
        for (let t = 0; t < nFrames; t++) {
            melSpec[t] = new Float32Array(nMel);
            const frame = stft[t];
            
            for (let m = 0; m < nMel; m++) {
                let sum = 0;
                const filter = filters[m];
                
                for (let f = 0; f < frame.length; f++) {
                    sum += frame[f] * filter[f];
                }
                
                melSpec[t][m] = sum;
            }
        }
        
        return melSpec; // [n_frames][n_mels]
    }
    
    /**
     * Convert power spectrogram to dB scale (as in librosa.power_to_db)
     */
    powerToDb(melSpec) {
        const ref = 1.0; // Reference value (as in np.max in training)
        const amin = 1e-10; // Minimum value to avoid log(0)
        const topDb = 80.0; // As in librosa default
        
        const nFrames = melSpec.length;
        const nMel = this.n_mels;
        
        // Find global maximum for reference (as in ref=np.max)
        let globalMax = amin;
        for (let t = 0; t < nFrames; t++) {
            for (let m = 0; m < nMel; m++) {
                if (melSpec[t][m] > globalMax) {
                    globalMax = melSpec[t][m];
                }
            }
        }
        
        const melSpecDb = new Array(nFrames);
        for (let t = 0; t < nFrames; t++) {
            melSpecDb[t] = new Float32Array(nMel);
            for (let m = 0; m < nMel; m++) {
                const power = Math.max(melSpec[t][m], amin);
                let db = 10 * Math.log10(power / globalMax);
                
                // Apply top_db clipping (as in librosa)
                if (db < -topDb) {
                    db = -topDb;
                }
                
                melSpecDb[t][m] = db;
            }
        }
        
        return melSpecDb; // [n_frames][n_mels] in dB
    }
    
    /**
     * Pad or trim to max_length (as in training)
     */
    padOrTrim(melSpecDb) {
        const nFrames = melSpecDb.length;
        const nMel = this.n_mels;
        const maxLength = this.max_length;
        
        if (nFrames >= maxLength) {
            // Trim: take first max_length frames
            return melSpecDb.slice(0, maxLength);
        } else {
            // Pad with zeros (silence in dB is -80)
            const padded = new Array(maxLength);
            
            // Copy existing frames
            for (let t = 0; t < nFrames; t++) {
                padded[t] = melSpecDb[t];
            }
            
            // Pad with -80 dB (silence)
            for (let t = nFrames; t < maxLength; t++) {
                padded[t] = new Float32Array(nMel);
                for (let m = 0; m < nMel; m++) {
                    padded[t][m] = -80; // Silence in dB scale
                }
            }
            
            return padded;
        }
    }
    
    /**
     * Transpose: [frames][n_mels] → [n_mels][frames] (as in training)
     * This matches the format: torch.FloatTensor(mel_spec_db.T)
     */
    transpose(melSpecDb) {
        const nFrames = melSpecDb.length;
        const nMel = this.n_mels;
        
        const transposed = new Array(nMel);
        for (let m = 0; m < nMel; m++) {
            transposed[m] = new Float32Array(nFrames);
            for (let t = 0; t < nFrames; t++) {
                transposed[m][t] = melSpecDb[t][m];
            }
        }
        
        return transposed; // [n_mels][n_frames]
    }
    
    /**
     * Normalize mel spectrogram (optional - check if model expects normalized input)
     * Two common methods: z-score or min-max
     */
    normalize(melSpec, method = 'zscore') {
        const nMel = melSpec.length;
        const nFrames = melSpec[0].length;
        
        const normalized = new Array(nMel);
        
        for (let m = 0; m < nMel; m++) {
            const band = Array.from(melSpec[m]);
            normalized[m] = new Float32Array(nFrames);
            
            if (method === 'zscore') {
                // Z-score normalization (mean=0, std=1)
                const mean = band.reduce((a, b) => a + b, 0) / band.length;
                const std = Math.sqrt(band.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / band.length);
                
                if (std > 0) {
                    for (let t = 0; t < nFrames; t++) {
                        normalized[m][t] = (melSpec[m][t] - mean) / std;
                    }
                } else {
                    normalized[m] = melSpec[m].slice(); // Copy as-is
                }
            } else {
                // Min-max normalization to [-1, 1]
                const min = Math.min(...band);
                const max = Math.max(...band);
                const range = max - min;
                
                if (range > 0) {
                    for (let t = 0; t < nFrames; t++) {
                        normalized[m][t] = 2 * (melSpec[m][t] - min) / range - 1;
                    }
                } else {
                    normalized[m] = melSpec[m].slice(); // Copy as-is
                }
            }
        }
        
        return normalized;
    }
    
    /**
     * Debug function: log mel spectrogram stats
     */
    debugMelSpectrogram(melSpec) {
        console.log('Mel Spectrogram Debug Info:');
        console.log(`- Shape: ${melSpec.length} mel bands × ${melSpec[0].length} frames`);
        
        // Calculate statistics
        let min = Infinity;
        let max = -Infinity;
        let sum = 0;
        let count = 0;
        
        for (let m = 0; m < melSpec.length; m++) {
            for (let t = 0; t < melSpec[m].length; t++) {
                const val = melSpec[m][t];
                if (val < min) min = val;
                if (val > max) max = val;
                sum += val;
                count++;
            }
        }
        
        const mean = sum / count;
        console.log(`- Min: ${min.toFixed(2)} dB`);
        console.log(`- Max: ${max.toFixed(2)} dB`);
        console.log(`- Mean: ${mean.toFixed(2)} dB`);
        console.log(`- Range: ${(max - min).toFixed(2)} dB`);
        
        return { min, max, mean };
    }
}

// Export for Node.js or browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MelSpectrogramProcessor;
}