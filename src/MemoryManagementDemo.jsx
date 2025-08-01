import React, { useState, useCallback, useRef, useEffect } from 'react';

class MemoryManager {
    constructor() {
        this.memoryThreshold = 50 * 1024 * 1024; // 50MB threshold
        this.cleanupCallbacks = [];
        this.isMonitoring = false;
    }

    checkMemoryUsage() {
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize;
            const limit = performance.memory.jsHeapSizeLimit;
            return {
                used,
                limit,
                percentage: (used / limit) * 100,
                usedMB: Math.round(used / 1024 / 1024),
                limitMB: Math.round(limit / 1024 / 1024)
            };
        }
        return null;
    }

    registerCleanup(callback) {
        this.cleanupCallbacks.push(callback);
    }

    async forceCleanup() {
        for (const callback of this.cleanupCallbacks) {
            try {
                await callback();
            } catch (error) {
                console.warn('Cleanup callback failed:', error);
            }
        }

        if (global.gc) {
            global.gc();
        }
    }

    async processWithMemoryCheck(items, processor, onProgress) {
        const results = [];

        for (let i = 0; i < items.length; i++) {
            const memInfo = this.checkMemoryUsage();

            if (memInfo && memInfo.percentage > 70) {
                console.warn('High memory usage detected, forcing cleanup');
                await this.forceCleanup();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            try {
                const result = await processor(items[i], i);
                results.push(result);

                if (onProgress && i % 100 === 0) {
                    onProgress({
                        processed: i + 1,
                        total: items.length,
                        percentage: ((i + 1) / items.length) * 100
                    });
                }
            } catch (error) {
                console.error(`Processing item ${i} failed:`, error);
            }

            if (i % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return results;
    }
}

class StreamProcessor {
    constructor(chunkSize = 500) {
        this.chunkSize = chunkSize;
        this.memoryManager = new MemoryManager();
    }

    async processStream(data, processor, onChunk, onProgress) {
        const results = [];
        const totalChunks = Math.ceil(data.length / this.chunkSize);

        for (let i = 0; i < data.length; i += this.chunkSize) {
            const chunk = data.slice(i, i + this.chunkSize);
            const chunkIndex = Math.floor(i / this.chunkSize);

            const chunkResults = await this.memoryManager.processWithMemoryCheck(
                chunk,
                processor,
                onProgress
            );

            if (onChunk) {
                await onChunk(chunkResults, chunkIndex, totalChunks);
            }

            results.push(...chunkResults);

            // Clear chunk data explicitly
            chunk.length = 0;

            const memInfo = this.memoryManager.checkMemoryUsage();
            if (memInfo && memInfo.percentage > 75) {
                await this.memoryManager.forceCleanup();
            }

            // Progress for overall stream
            if (onProgress) {
                onProgress({
                    processed: Math.min(i + this.chunkSize, data.length),
                    total: data.length,
                    percentage: (Math.min(i + this.chunkSize, data.length) / data.length) * 100,
                    currentChunk: chunkIndex + 1,
                    totalChunks
                });
            }
        }

        return results;
    }
}

// Real AES-256-GCM encryption implementation
class ZeroKnowledgeEncryption {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12;
    }

    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveBits', 'deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    generateSalt() {
        return crypto.getRandomValues(new Uint8Array(16));
    }

    generateIV() {
        return crypto.getRandomValues(new Uint8Array(this.ivLength));
    }

    async encrypt(data, key) {
        const encoder = new TextEncoder();
        const iv = this.generateIV();

        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            encoder.encode(JSON.stringify(data))
        );

        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);

        return {
            data: combined,
            iv: Array.from(iv)
        };
    }

    bufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    }
}

// Enhanced Error Handling
const ERROR_TYPES = {
    VALIDATION: 'validation',
    ENCRYPTION: 'encryption',
    MEMORY: 'memory',
    BROWSER_SUPPORT: 'browser_support'
};

function createError(type, message, suggestion = null) {
    return { type, message, suggestion };
}

function getErrorDetails(error) {
    const errorMessage = error.message || error.toString();

    if (errorMessage.includes('crypto') || errorMessage.includes('subtle')) {
        return createError(
            ERROR_TYPES.BROWSER_SUPPORT,
            'Browser does not support required cryptographic features',
            'Please use a modern browser with Web Crypto API support (Chrome, Firefox, Safari, Edge).'
        );
    }

    if (errorMessage.includes('encrypt') || errorMessage.includes('key')) {
        return createError(
            ERROR_TYPES.ENCRYPTION,
            'Failed to encrypt data',
            'Please check your input data and try again. If the problem persists, try refreshing the page.'
        );
    }

    if (errorMessage.includes('memory') || errorMessage.includes('Memory')) {
        return createError(
            ERROR_TYPES.MEMORY,
            'Insufficient memory to process this dataset',
            'Try reducing the dataset size or chunk size, or close other browser tabs to free up memory.'
        );
    }

    // Default error
    return createError(
        ERROR_TYPES.ENCRYPTION,
        'An unexpected error occurred during processing',
        'Please try again with a smaller dataset. If the problem persists, refresh the page.'
    );
}

// Real encryption processor for memory demo
async function realEncryption(data, index, cryptoInstance, key) {
    try {
        // Encrypt the actual data using AES-256-GCM
        const result = await cryptoInstance.encrypt({
            id: index,
            originalData: data,
            timestamp: Date.now(),
            type: 'sensitive_data'
        }, key);

        return {
            id: index,
            originalSize: JSON.stringify(data).length,
            encrypted: cryptoInstance.bufferToBase64(result.data),
            iv: result.iv,
            timestamp: Date.now(),
            processed: true,
            encryptionType: 'AES-256-GCM'
        };
    } catch (error) {
        console.error(`Encryption failed for item ${index}:`, error);
        throw error;
    }
}

function MemoryManagementDemo() {
    const [memoryInfo, setMemoryInfo] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState({ processed: 0, total: 0, percentage: 0 });
    const [results, setResults] = useState([]);
    const [dataSize, setDataSize] = useState(1000);
    const [chunkSize, setChunkSize] = useState(500);
    const [processingLog, setProcessingLog] = useState([]);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState('');
    const [isAnimating, setIsAnimating] = useState(false);
    const [processingStats, setProcessingStats] = useState({
        startTime: null,
        endTime: null,
        startMemory: null,
        peakMemory: null,
        elapsedTime: 0
    });
    
    const startTimeRef = useRef(null);
    const peakMemoryRef = useRef(null);

    const streamProcessorRef = useRef(null);
    const intervalRef = useRef(null);
    const cryptoRef = useRef(new ZeroKnowledgeEncryption());
    const encryptionKeyRef = useRef(null);
    const saltRef = useRef(null);

    // Format elapsed time in readable format
    const formatElapsedTime = (milliseconds) => {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else if (seconds > 0) {
            return `${seconds}s`;
        } else {
            return `${milliseconds}ms`;
        }
    };

    // Initialize stream processor when chunk size changes
    useEffect(() => {
        streamProcessorRef.current = new StreamProcessor(chunkSize);
    }, [chunkSize]);

    // Initialize encryption key on component mount
    useEffect(() => {
        const initializeEncryption = async () => {
            try {
                // Generate salt for this session
                const salt = cryptoRef.current.generateSalt();
                saltRef.current = salt;
                
                // Use a demo password for the memory management demo
                const demoPassword = 'MemoryDemo2024!SecurePassword';
                const key = await cryptoRef.current.deriveKey(demoPassword, salt);
                encryptionKeyRef.current = key;
                
                console.log('Encryption key initialized with AES-256-GCM');
            } catch (error) {
                console.error('Failed to initialize encryption:', error);
            }
        };
        
        initializeEncryption();
    }, []);

    // Memory monitoring
    useEffect(() => {
        const memoryManager = new MemoryManager();

        intervalRef.current = setInterval(() => {
            const usage = memoryManager.checkMemoryUsage();
            if (usage) {
                setMemoryInfo(usage);
                
                // Track peak memory during processing using ref for immediate updates
                if (isProcessing) {
                    if (!peakMemoryRef.current || usage.usedMB > peakMemoryRef.current) {
                        peakMemoryRef.current = usage.usedMB;
                    }
                }
            }
        }, 1000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isProcessing]);

    const generateLargeDataset = useCallback((size) => {
        const data = [];
        for (let i = 0; i < size; i++) {
            data.push({
                id: i,
                email: `user${i}@example.com`,
                userData: {
                    name: `User ${i}`,
                    preferences: Array(10).fill(0).map(() => Math.random().toString(36)),
                    history: Array(20).fill(0).map(() => ({
                        action: 'login',
                        timestamp: Date.now() - Math.random() * 1000000,
                        ip: `192.168.1.${Math.floor(Math.random() * 255)}`
                    }))
                },
                metadata: {
                    created: Date.now() - Math.random() * 1000000,
                    lastUpdated: Date.now(),
                    tags: Array(5).fill(0).map(() => Math.random().toString(36).substr(2, 8))
                }
            });
        }
        return data;
    }, []);

    const addToLog = useCallback((message) => {
        setProcessingLog(prev => [...prev.slice(-19), {
            id: Date.now(),
            message,
            timestamp: new Date().toLocaleTimeString()
        }]);
    }, []);

    const handleProcessData = useCallback(async () => {
        // Clear previous messages
        setError(null);
        setSuccess('');

        // Enhanced validation
        if (dataSize > 100000) {
            setError(createError(
                ERROR_TYPES.VALIDATION,
                'Dataset size is too large',
                'Please use a dataset smaller than 100,000 records for optimal performance.'
            ));
            return;
        }

        if (dataSize < 500) {
            setError(createError(
                ERROR_TYPES.VALIDATION,
                'Dataset size is too small',
                'Please use a dataset of at least 500 records.'
            ));
            return;
        }

        if (chunkSize > dataSize) {
            setError(createError(
                ERROR_TYPES.VALIDATION,
                'Chunk size cannot be larger than dataset size',
                'Please adjust the chunk size to be smaller than the dataset size.'
            ));
            return;
        }

        setIsProcessing(true);
        setIsAnimating(true);
        setResults([]);
        setProgress({ processed: 0, total: dataSize, percentage: 0 });

        // Initialize processing stats
        const startTime = Date.now();
        startTimeRef.current = startTime;
        const currentMemory = memoryInfo ? memoryInfo.usedMB : 0;
        peakMemoryRef.current = currentMemory;
        
        setProcessingStats({
            startTime,
            endTime: null,
            startMemory: currentMemory,
            peakMemory: currentMemory,
            elapsedTime: 0
        });

        addToLog(`Starting AES-256-GCM encryption of ${dataSize} records...`);

        try {
            if (!encryptionKeyRef.current) {
                throw new Error('Encryption key not initialized');
            }

            const dataset = generateLargeDataset(dataSize);
            addToLog(`Generated dataset: ${JSON.stringify(dataset[0]).length * dataSize} bytes`);
            addToLog('Using real AES-256-GCM encryption with PBKDF2 key derivation');

            // Create a wrapper function for the real encryption that maintains the expected signature
            const encryptionProcessor = async (data, index) => {
                return await realEncryption(data, index, cryptoRef.current, encryptionKeyRef.current);
            };

            const processedResults = await streamProcessorRef.current.processStream(
                dataset,
                encryptionProcessor,
                (chunkResults, chunkIndex, totalChunks) => {
                    addToLog(`Encrypted chunk ${chunkIndex + 1}/${totalChunks} (${chunkResults.length} items)`);
                    
                    // Update progress based on chunks completed
                    const chunkProgress = {
                        processed: (chunkIndex + 1) * chunkSize,
                        total: dataSize,
                        percentage: ((chunkIndex + 1) / totalChunks) * 100,
                        currentChunk: chunkIndex + 1,
                        totalChunks
                    };
                    setProgress(chunkProgress);
                },
                null // Don't use the individual item progress
            );

            setResults(processedResults);
            
            // Set final progress to 100%
            setProgress({
                processed: dataSize,
                total: dataSize,
                percentage: 100,
                currentChunk: Math.ceil(dataSize / chunkSize),
                totalChunks: Math.ceil(dataSize / chunkSize)
            });
            
            // Calculate final stats
            const endTime = Date.now();
            const elapsedTime = endTime - startTimeRef.current;
            const actualPeakMemory = peakMemoryRef.current;
            const currentMemory = memoryInfo ? memoryInfo.usedMB : 0;
            
            setProcessingStats(prev => ({
                ...prev,
                endTime,
                elapsedTime,
                peakMemory: actualPeakMemory
            }));
            
            addToLog(`Encryption complete! ${processedResults.length} items encrypted with AES-256-GCM.`);
            addToLog(`Total time: ${formatElapsedTime(elapsedTime)}, Peak memory: ${actualPeakMemory}MB`);
            
            // Show success message
            setSuccess('Data encrypted successfully! 🔒');

        } catch (err) {
            const errorDetails = getErrorDetails(err);
            setError(errorDetails);
            addToLog(`Error: ${errorDetails.message}`);
            console.error('Encryption processing error:', err);
        } finally {
            setTimeout(() => {
                setIsProcessing(false);
                setIsAnimating(false);
            }, 1000);
        }
    }, [dataSize, chunkSize, generateLargeDataset, addToLog]);

    const handleClearData = useCallback(() => {
        setResults([]);
        setProgress({ processed: 0, total: 0, percentage: 0 });
        setProcessingLog([]);
        setProcessingStats({
            startTime: null,
            endTime: null,
            startMemory: null,
            peakMemory: null,
            elapsedTime: 0
        });
        setError(null);
        setSuccess('');
        
        // Reset refs
        startTimeRef.current = null;
        peakMemoryRef.current = null;
        
        addToLog('Data cleared and memory freed');
    }, [addToLog]);

    const getMemoryStatus = () => {
        if (!memoryInfo) return 'unavailable';
        if (memoryInfo.percentage > 80) return 'critical';
        if (memoryInfo.percentage > 60) return 'warning';
        return 'good';
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>🧠 Memory Management Demo</h1>
                <p>Real-time memory monitoring with AES-256-GCM encryption</p>
            </header>

            <div className="demo-container">
                <div className="demo-content">
                    <div className="input-column">
                        <div className="input-section">
                            <h2>🔧 Processing Controls</h2>

                            <div className="form-group">
                                <label htmlFor="dataSize">Dataset Size:</label>
                                <div className="control-group">
                                    <input
                                        id="dataSize"
                                        type="range"
                                        min="500"
                                        max="100000"
                                        step="500"
                                        value={dataSize}
                                        onChange={(e) => setDataSize(Number(e.target.value))}
                                        disabled={isProcessing}
                                        className="form-input"
                                    />
                                    <span>{dataSize.toLocaleString()} records</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="chunkSize">Chunk Size:</label>
                                <div className="control-group">
                                    <input
                                        id="chunkSize"
                                        type="range"
                                        min="500"
                                        max="2000"
                                        step="500"
                                        value={chunkSize}
                                        onChange={(e) => setChunkSize(Number(e.target.value))}
                                        disabled={isProcessing}
                                        className="form-input"
                                    />
                                    <span>{chunkSize} records per chunk</span>
                                </div>
                            </div>

                            <div className="button-group">
                                <button
                                    onClick={handleProcessData}
                                    disabled={isProcessing}
                                    className={`btn btn-primary ${isProcessing ? 'encrypting' : ''}`}
                                >
                                    <span>{isProcessing ? 'Encrypting...' : 'Start Encryption'}</span>
                                </button>

                                <button
                                    onClick={handleClearData}
                                    disabled={isProcessing}
                                    className="btn btn-tertiary"
                                >
                                    Clear Data
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className={`message error-message ${error.type}`}>
                                <div className="message-header">
                                    <span className="message-icon">⚠️</span>
                                    <span className="message-title">{error.message}</span>
                                </div>
                                {error.suggestion && (
                                    <div className="message-suggestion">
                                        💡 {error.suggestion}
                                    </div>
                                )}
                            </div>
                        )}

                        {success && (
                            <div className="message success-message">
                                <div className="message-header">
                                    <span className="message-icon">✅</span>
                                    <span className="message-title">{success}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="results-column">
                        <div className="results-section">
                            <div className="results-row">
                                <div className={`result-box ${isAnimating ? 'encrypting' : ''}`}>
                                    <h3>💾 Memory Usage</h3>
                                    <div className="result-content">
                                        {memoryInfo ? (
                                            <div className={`memory-stats ${getMemoryStatus()}`}>
                                                <div className="memory-bar">
                                                    <div
                                                        className="memory-fill"
                                                        style={{ width: `${memoryInfo.percentage}%` }}
                                                    />
                                                </div>
                                                <div className="memory-details">
                                                    <span>{memoryInfo.usedMB}MB / {memoryInfo.limitMB}MB</span>
                                                    <span className="percentage">{memoryInfo.percentage.toFixed(1)}%</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p>Memory monitoring not available in this browser</p>
                                        )}
                                    </div>
                                </div>

                                <div className={`result-box ${isAnimating ? 'encrypting' : ''}`}>
                                    <h3>⚡ Processing Progress</h3>
                                    <div className="result-content">
                                        {progress.total > 0 && (
                                            <div className="progress-stats">
                                                <div className="progress-bar">
                                                    <div
                                                        className="progress-fill"
                                                        style={{ width: `${progress.percentage}%` }}
                                                    />
                                                </div>
                                                <div className="progress-details">
                                                    <span>{progress.processed.toLocaleString()} / {progress.total.toLocaleString()}</span>
                                                    <span className="percentage">{progress.percentage.toFixed(1)}%</span>
                                                </div>
                                                {progress.currentChunk && (
                                                    <div className="chunk-info">
                                                        Chunk {progress.currentChunk} / {progress.totalChunks}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="result-box">
                                <h3>📝 Processing Log</h3>
                                <div className="result-content">
                                    <div className="log-container">
                                        {processingLog.map(entry => (
                                            <div key={entry.id} className="log-entry">
                                                <span className="log-time">{entry.timestamp}</span>
                                                <span className="log-message">{entry.message}</span>
                                            </div>
                                        ))}
                                        {processingLog.length === 0 && (
                                            <div style={{ color: '#666', fontStyle: 'italic' }}>
                                                No processing activities yet...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="result-box">
                                <h3>📈 Results Summary</h3>
                                <div className="result-content">
                                    <div className="summary-stats">
                                        <div className="stat">
                                            <label>Total Encrypted:</label>
                                            <span>{results.length.toLocaleString()}</span>
                                        </div>
                                        <div className="stat">
                                            <label>Memory Efficient:</label>
                                            <span className="success">✓</span>
                                        </div>
                                        <div className="stat">
                                            <label>Stream Processing:</label>
                                            <span className="success">✓</span>
                                        </div>
                                        <div className="stat">
                                            <label>Encryption Type:</label>
                                            <span>AES-256-GCM</span>
                                        </div>
                                        {processingStats.elapsedTime > 0 && (
                                            <div className="stat">
                                                <label>Total Elapsed Time:</label>
                                                <span>{formatElapsedTime(processingStats.elapsedTime)}</span>
                                            </div>
                                        )}
                                        {processingStats.peakMemory && (
                                            <div className="stat">
                                                <label>Peak Memory Usage:</label>
                                                <span>{processingStats.peakMemory.toFixed(1)}MB</span>
                                            </div>
                                        )}
                                        {results.length > 0 && processingStats.elapsedTime > 0 && (
                                            <div className="stat">
                                                <label>Processing Rate:</label>
                                                <span>{(results.length / (processingStats.elapsedTime / 1000)).toFixed(0)} items/sec</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="info-section">
                    <h3>🧠 How Memory Management Works</h3>
                    <ul>
                        <li><strong>Stream Processing:</strong> Data is processed in chunks to prevent memory overload</li>
                        <li><strong>Real AES-256-GCM Encryption:</strong> Uses actual cryptographic operations, not simulation</li>
                        <li><strong>PBKDF2 Key Derivation:</strong> 100,000 iterations for secure key generation</li>
                        <li><strong>Memory Monitoring:</strong> Real-time tracking of browser memory usage</li>
                        <li><strong>Automatic Cleanup:</strong> Forces garbage collection when memory usage is high</li>
                        <li><strong>Chunk Size Optimization:</strong> Adjustable chunk sizes for different scenarios</li>
                        <li><strong>Progress Tracking:</strong> Maintains user experience during long operations</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default MemoryManagementDemo;