import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

type Tab = 'image' | 'video' | 'audio';

const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
);
const PauseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
);
const StopIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"></path></svg>
);

const CodeBlock = ({ code }: { code: string }) => {
    const tokenRegex = /(\/\/.*|\[|\]|,|-?\d+\.\d+|-?\d+)/g;

    const highlightedCode = code.split('\n').map((line, i) => (
        <React.Fragment key={i}>
            {line.split(tokenRegex).map((part, j) => {
                if (!part) return null;
                if (part.startsWith('//')) {
                    return <span key={j} className="token-comment">{part}</span>;
                }
                if (/^[\],\[]$/.test(part)) {
                    return <span key={j} className="token-punctuation">{part}</span>;
                }
                if (/^-?\d+(\.\d+)?$/.test(part)) {
                    return <span key={j} className="token-number">{part}</span>;
                }
                return part;
            })}
            {'\n'}
        </React.Fragment>
    ));

    return (
        <pre>
            <code>{highlightedCode}</code>
        </pre>
    );
};

const PixelMatrix = ({ pixelData }: { pixelData: ImageData | null }) => {
    if (!pixelData) {
        return <div className="placeholder-text">Selecciona una región para visualizar.</div>;
    }
    const { data, width, height } = pixelData;
    const rows = [];
    for (let y = 0; y < height; y++) {
        const cells = [];
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            cells.push(
                <div key={x} className="pixel-cell" style={{
                    backgroundColor: `rgba(${data[i]}, ${data[i+1]}, ${data[i+2]}, ${data[i+3] / 255})`
                }}></div>
            );
        }
        rows.push(<div key={y} className="matrix-row">{cells}</div>);
    }
    return <div className="matrix-visualizer">{rows}</div>;
};

const ImagePanel = () => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    const [selection, setSelection] = useState({ x: 0, y: 0, width: 10, height: 10 });
    const [pixelData, setPixelData] = useState<ImageData | null>(null);
    const [dataRepresentation, setDataRepresentation] = useState<string>('');
    const [showData, setShowData] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement>(new Image());

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const src = event.target?.result as string;
                imgRef.current.src = src;
                imgRef.current.onload = () => {
                    const { width, height } = imgRef.current;
                    setImageDimensions({ width, height });
                    const newSelection = {
                        x: 0, y: 0,
                        width: Math.min(10, width),
                        height: Math.min(10, height)
                    };
                    setSelection(newSelection);
                };
                setImageSrc(src);
                setShowData(false);
                setDataRepresentation('');
                setPixelData(null);
            };
            reader.readAsDataURL(file);
        }
    };
    
    useEffect(() => {
        if (!imageSrc || !canvasRef.current || !imageDimensions.width) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = imageDimensions.width;
        canvas.height = imageDimensions.height;
        ctx.drawImage(imgRef.current, 0, 0);
        
        const clampedWidth = Math.min(selection.width, imageDimensions.width - selection.x);
        const clampedHeight = Math.min(selection.height, imageDimensions.height - selection.y);

        if (clampedWidth > 0 && clampedHeight > 0) {
            ctx.fillStyle = 'rgba(3, 218, 198, 0.3)';
            ctx.strokeStyle = 'rgba(3, 218, 198, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.fillRect(selection.x, selection.y, clampedWidth, clampedHeight);
            ctx.strokeRect(selection.x, selection.y, clampedWidth, clampedHeight);

            const imageData = ctx.getImageData(selection.x, selection.y, clampedWidth, clampedHeight);
            setPixelData(imageData);
        } else {
            setPixelData(null);
        }
    }, [imageSrc, imageDimensions, selection]);
    
    const getCanvasCoords = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!imageSrc) return;
        setIsDrawing(true);
        const coords = getCanvasCoords(e);
        setStartPoint(coords);
        setSelection({ x: coords.x, y: coords.y, width: 0, height: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const currentCoords = getCanvasCoords(e);
        const newSelection = {
            x: Math.round(Math.min(currentCoords.x, startPoint.x)),
            y: Math.round(Math.min(currentCoords.y, startPoint.y)),
            width: Math.round(Math.abs(currentCoords.x - startPoint.x)),
            height: Math.round(Math.abs(currentCoords.y - startPoint.y))
        };
        setSelection(newSelection);
    };

    const handleMouseUpOrLeave = () => {
        setIsDrawing(false);
    };

    const generateDataRepresentation = () => {
        if (!pixelData) {
            setDataRepresentation('// No hay datos de píxeles para mostrar.');
            return;
        }

        const { data, width, height } = pixelData;
        let text = `// Mostrando ${width}x${height} píxeles de la región (${selection.x},${selection.y})\n`;
        text += `// Tensor de forma: [Altura, Ancho, Canales_RGBA]\n`;
        text += `[\n`;
        for (let y = 0; y < height; y++) {
            text += '  [\n';
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                text += `    [${data[i]}, ${data[i + 1]}, ${data[i + 2]}, ${data[i + 3]}], // Píxel (${x},${y})\n`;
            }
            text += '  ],\n';
        }
        text += ']';
        setDataRepresentation(text);
    };

    const toggleShowData = () => {
        if (!showData) {
             generateDataRepresentation();
        }
        setShowData(!showData);
    };

    const handleSelectionChange = (field: keyof typeof selection, value: number) => {
        const numericValue = Math.max(0, value);
        setSelection(prev => ({ ...prev, [field]: numericValue }));
    };

    return (
        <div className="content-panel">
            <div className="media-container">
                 <div className="controls">
                    <p>Carga una imagen para analizar</p>
                    <label className="file-input-label" htmlFor="image-upload">Seleccionar Archivo</label>
                    <input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} />
                </div>
                 <div className="media-visual">
                    {imageSrc ? (
                        <canvas
                            ref={canvasRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUpOrLeave}
                            onMouseLeave={handleMouseUpOrLeave}
                            className="interactive-canvas"
                        />
                    ) : (
                        <div className="placeholder-text">Carga una imagen para empezar</div>
                    )}
                </div>
                {imageSrc && (
                    <div className="selection-controls">
                        <h4>Controles de Visualización</h4>
                        <div className="control-row">
                            <label>X: {selection.x}</label>
                            <input type="range" min="0" max={imageDimensions.width - 1} value={selection.x} onChange={e => handleSelectionChange('x', parseInt(e.target.value))} />
                        </div>
                        <div className="control-row">
                            <label>Y: {selection.y}</label>
                            <input type="range" min="0" max={imageDimensions.height - 1} value={selection.y} onChange={e => handleSelectionChange('y', parseInt(e.target.value))} />
                        </div>
                         <div className="control-row">
                            <label>Ancho: {selection.width}</label>
                            <input type="range" min="1" max={Math.min(200, imageDimensions.width)} value={selection.width} onChange={e => handleSelectionChange('width', parseInt(e.target.value))} />
                        </div>
                        <div className="control-row">
                            <label>Alto: {selection.height}</label>
                            <input type="range" min="1" max={Math.min(200, imageDimensions.height)} value={selection.height} onChange={e => handleSelectionChange('height', parseInt(e.target.value))} />
                        </div>
                    </div>
                )}
                 <button className="view-data-button" onClick={toggleShowData} disabled={!imageSrc}>
                    {showData ? 'Ocultar Datos Numéricos' : 'Ver Datos Numéricos'}
                </button>
            </div>
            <div className="data-container">
                 <h3>Representación de Imagen</h3>
                <p>Una imagen es una rejilla de píxeles (tensor 3D: [Alto x Ancho x RGBA]). Selecciona una región para ver su representación gráfica y numérica.</p>
                <h4>Visualización de Matriz de Píxeles</h4>
                <PixelMatrix pixelData={pixelData} />
                 <h4>Datos Numéricos de la Selección</h4>
                <div className="data-representation">
                     <CodeBlock code={showData ? dataRepresentation : '// Haz clic en "Ver Datos Numéricos" para ver el tensor...'} />
                </div>
            </div>
        </div>
    );
};


const VideoPanel = () => {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [pixelData, setPixelData] = useState<ImageData | null>(null);
    const [dataRepresentation, setDataRepresentation] = useState<string>('');
    const [showData, setShowData] = useState(false);
    
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
    const [selection, setSelection] = useState({ x: 0, y: 0, width: 10, height: 10 });
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const fileUrl = URL.createObjectURL(e.target.files[0]);
            setVideoSrc(fileUrl);
            setIsPlaying(false);
            setShowData(false);
            setPixelData(null);
            setDataRepresentation('');
            setCurrentTime(0);
        }
    };
    
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const handleMetadata = () => {
            setDuration(video.duration);
            const { videoWidth, videoHeight } = video;
            setVideoDimensions({ width: videoWidth, height: videoHeight });
            const newSelection = {
                x: 0, y: 0,
                width: Math.min(10, videoWidth),
                height: Math.min(10, videoHeight)
            };
            setSelection(newSelection);
        };
        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleSeeked = () => setCurrentTime(video.currentTime);

        video.addEventListener('loadedmetadata', handleMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('seeked', handleSeeked);
        return () => {
            video.removeEventListener('loadedmetadata', handleMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('seeked', handleSeeked);
        }
    }, [videoSrc]);
    
    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !videoDimensions.width) return;
    
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
    
        if (!isPlaying) {
            canvas.width = videoDimensions.width;
            canvas.height = videoDimensions.height;
            ctx.drawImage(video, 0, 0, videoDimensions.width, videoDimensions.height);
        }
    
        const clampedWidth = Math.min(selection.width, videoDimensions.width - selection.x);
        const clampedHeight = Math.min(selection.height, videoDimensions.height - selection.y);
    
        if (clampedWidth > 0 && clampedHeight > 0) {
            if (!isPlaying) { // Only redraw selection on static frame
                ctx.fillStyle = 'rgba(3, 218, 198, 0.3)';
                ctx.strokeStyle = 'rgba(3, 218, 198, 0.9)';
                ctx.lineWidth = 1.5;
                ctx.fillRect(selection.x, selection.y, clampedWidth, clampedHeight);
                ctx.strokeRect(selection.x, selection.y, clampedWidth, clampedHeight);
            }
            const imageData = ctx.getImageData(selection.x, selection.y, clampedWidth, clampedHeight);
            setPixelData(imageData);
        } else {
            setPixelData(null);
        }
    }, [isPlaying, selection, currentTime, videoDimensions, videoSrc]);
    
    const getCanvasCoords = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!videoSrc || isPlaying) return;
        setIsDrawing(true);
        const coords = getCanvasCoords(e);
        setStartPoint(coords);
        setSelection({ x: coords.x, y: coords.y, width: 0, height: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const currentCoords = getCanvasCoords(e);
        const newSelection = {
            x: Math.round(Math.min(currentCoords.x, startPoint.x)),
            y: Math.round(Math.min(currentCoords.y, startPoint.y)),
            width: Math.round(Math.abs(currentCoords.x - startPoint.x)),
            height: Math.round(Math.abs(currentCoords.y - startPoint.y))
        };
        setSelection(newSelection);
    };

    const handleMouseUpOrLeave = () => setIsDrawing(false);
    const handleSelectionChange = (field: keyof typeof selection, value: number) => {
        const numericValue = Math.max(0, value);
        setSelection(prev => ({ ...prev, [field]: numericValue }));
    };

    const handleTimeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (videoRef.current) {
            videoRef.current.currentTime = parseFloat(e.target.value);
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.pause();
            else videoRef.current.play();
            setIsPlaying(!isPlaying);
        }
    };

    const handleStop = () => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    };
    
    const generateDataRepresentation = () => {
        if (!pixelData) {
            setDataRepresentation("// No hay datos de píxeles para mostrar.");
            return;
        }
        
        const { data, width, height } = pixelData;
        let text = `// Mostrando ${width}x${height} píxeles de la región (${selection.x},${selection.y}) en el tiempo ${currentTime.toFixed(2)}s\n`;
        text += `// Tensor de forma: [Fotogramas, Altura, Ancho, Canales_RGBA]\n`;
        text += `// Se muestra una porción del fotograma actual:\n`;
        text += `[\n`;
         for (let y = 0; y < height; y++) {
            text += '  [\n';
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                text += `    [${data[i]}, ${data[i + 1]}, ${data[i + 2]}, ${data[i + 3]}], // Píxel (${x},${y})\n`;
            }
            text += '  ],\n';
        }
        text += ']';
        setDataRepresentation(text);
    };
    
    const toggleShowData = () => {
        if (!showData) {
            generateDataRepresentation();
        }
        setShowData(!showData);
    };

    return (
        <div className="content-panel">
            <div className="media-container">
                <div className="controls">
                    <p>Carga un video para analizar</p>
                    <label className="file-input-label" htmlFor="video-upload">Seleccionar Archivo</label>
                    <input id="video-upload" type="file" accept="video/*" onChange={handleFileChange} />
                </div>
                <div className="media-visual">
                    {videoSrc ? (
                        <>
                            <video ref={videoRef} src={videoSrc} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} style={{ display: isPlaying ? 'block' : 'none' }}/>
                            <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUpOrLeave} onMouseLeave={handleMouseUpOrLeave} className="interactive-canvas" style={{ display: !isPlaying ? 'block' : 'none', cursor: isPlaying ? 'default' : 'crosshair' }} />
                        </>
                    ) : (
                        <div className="placeholder-text">Carga un video para empezar</div>
                    )}
                </div>
                 <div className="media-actions">
                    <button className="action-button" onClick={togglePlay} disabled={!videoSrc}>
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        {isPlaying ? 'Pausa' : 'Play'}
                    </button>
                    <button className="action-button" onClick={handleStop} disabled={!videoSrc}><StopIcon /> Stop</button>
                </div>
                {videoSrc && (
                    <>
                        <div className="selection-controls full-width">
                            <label>Tiempo: {currentTime.toFixed(2)}s / {duration.toFixed(2)}s</label>
                            <input className="time-slider" type="range" min="0" max={duration} step="0.01" value={currentTime} onChange={handleTimeSliderChange} />
                        </div>
                         <div className="selection-controls">
                            <h4>Controles de Selección (en pausa)</h4>
                            <div className="control-row">
                                <label>X: {selection.x}</label>
                                <input type="range" min="0" max={videoDimensions.width - 1} value={selection.x} onChange={e => handleSelectionChange('x', parseInt(e.target.value))} disabled={isPlaying} />
                            </div>
                            <div className="control-row">
                                <label>Y: {selection.y}</label>
                                <input type="range" min="0" max={videoDimensions.height - 1} value={selection.y} onChange={e => handleSelectionChange('y', parseInt(e.target.value))} disabled={isPlaying}/>
                            </div>
                             <div className="control-row">
                                <label>Ancho: {selection.width}</label>
                                <input type="range" min="1" max={Math.min(200, videoDimensions.width)} value={selection.width} onChange={e => handleSelectionChange('width', parseInt(e.target.value))} disabled={isPlaying}/>
                            </div>
                            <div className="control-row">
                                <label>Alto: {selection.height}</label>
                                <input type="range" min="1" max={Math.min(200, videoDimensions.height)} value={selection.height} onChange={e => handleSelectionChange('height', parseInt(e.target.value))} disabled={isPlaying}/>
                            </div>
                        </div>
                    </>
                )}
                <button className="view-data-button" onClick={toggleShowData} disabled={!videoSrc}>
                    {showData ? 'Ocultar Datos Numéricos' : 'Ver Datos Numéricos'}
                </button>
            </div>
            <div className="data-container">
                <h3>Representación de Video</h3>
                <p>Un video es una secuencia de fotogramas (tensor 4D). Pausa el video para seleccionar una región de un fotograma y analizar sus datos.</p>
                <h4>Visualización de Matriz de Píxeles (Fotograma)</h4>
                <PixelMatrix pixelData={pixelData} />
                <h4>Datos Numéricos del Fotograma</h4>
                <div className="data-representation">
                    <CodeBlock code={showData ? dataRepresentation : '// Pausa el video y haz clic en "Ver Datos Numéricos"...'} />
                </div>
            </div>
        </div>
    );
};

const AudioSampleChart = ({ samples }: { samples: Float32Array | null }) => {
    if (!samples || samples.length === 0) {
        return <div className="placeholder-text">Selecciona un rango para visualizar las muestras.</div>;
    }

    const width = 400; 
    const height = 100;
    const midY = height / 2;

    const pathData = Array.from(samples).map((sample, i) => {
        const x = (i / (samples.length > 1 ? samples.length - 1 : 1)) * width;
        const y = midY - (sample * midY);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    return (
        <div className="sample-chart-visualizer">
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <line x1="0" y1={midY} x2={width} y2={midY} stroke="var(--border-color)" strokeWidth="0.5" />
                <path d={pathData} stroke="var(--primary-color)" strokeWidth="1" fill="none" />
            </svg>
        </div>
    );
}

const AudioPanel = () => {
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [timeSelection, setTimeSelection] = useState({ start: 0, end: 0.05 });
    const [selectedSamples, setSelectedSamples] = useState<Float32Array | null>(null);
    const [dataRepresentation, setDataRepresentation] = useState<string>('');
    const [showData, setShowData] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioBufferRef = useRef<AudioBuffer | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const drawWaveform = useCallback((buffer: AudioBuffer) => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const data = buffer.getChannelData(0);
        const width = canvas.width;
        const height = canvas.height;
        const step = Math.ceil(data.length / width);
        const amp = height / 2;

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#03dac6';
        ctx.beginPath();
        ctx.moveTo(0, amp);

        for (let i = 0; i < width; i++) {
            let min = 1.0;
            let max = -1.0;
            for (let j = 0; j < step; j++) {
                const datum = data[(i * step) + j];
                if (datum < min) min = datum;
                if (datum > max) max = datum;
            }
            ctx.moveTo(i, (1 + min) * amp);
            ctx.lineTo(i, (1 + max) * amp);
        }
        ctx.stroke();
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAudioSrc(URL.createObjectURL(file));

            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const arrayBuffer = await file.arrayBuffer();
            audioContextRef.current.decodeAudioData(arrayBuffer, (buffer) => {
                audioBufferRef.current = buffer;
                setDuration(buffer.duration);
                const newTimeSelection = { start: 0, end: Math.min(0.05, buffer.duration) };
                setTimeSelection(newTimeSelection);
                updateVisuals(newTimeSelection);
                drawWaveform(buffer);
            });
            
            setShowData(false);
            setDataRepresentation('');
        }
    };
    
    const updateVisuals = useCallback((currentSelection: { start: number, end: number }) => {
        if (!audioBufferRef.current) return;
        const buffer = audioBufferRef.current;
        const sampleRate = buffer.sampleRate;
        const startSample = Math.floor(currentSelection.start * sampleRate);
        const endSample = Math.floor(currentSelection.end * sampleRate);

        if (startSample >= endSample) {
            setSelectedSamples(null);
            return;
        }

        const channelData = buffer.getChannelData(0);
        const samples = channelData.slice(startSample, endSample);
        setSelectedSamples(samples);
    }, []);
    
    useEffect(() => {
        updateVisuals(timeSelection);
    }, [timeSelection, updateVisuals]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
        }
    };
    
    const handleStop = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    };

    const generateDataRepresentation = () => {
        if (!selectedSamples || !audioBufferRef.current) return;
        
        let text = `// Mostrando ${selectedSamples.length} muestras desde ${timeSelection.start.toFixed(4)}s hasta ${timeSelection.end.toFixed(4)}s\n`;
        text += `// Frecuencia de muestreo: ${audioBufferRef.current.sampleRate} Hz\n`;
        text += `// Arreglo de valores de amplitud (de -1.0 a 1.0):\n`;
        text += '[\n  ';
        
        for (let i = 0; i < selectedSamples.length; i++) {
            text += `${selectedSamples[i].toFixed(4)}, `;
            if ((i + 1) % 8 === 0) text += '\n  ';
        }
        text += '\n  ...\n]';
        setDataRepresentation(text);
    };

    const toggleShowData = () => {
        if (!showData) {
            generateDataRepresentation();
        }
        setShowData(!showData);
    };

    useEffect(() => {
        const audio = audioRef.current;
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        audio?.addEventListener('play', onPlay);
        audio?.addEventListener('pause', onPause);
        audio?.addEventListener('ended', onPause);
        return () => {
            audio?.removeEventListener('play', onPlay);
            audio?.removeEventListener('pause', onPause);
            audio?.removeEventListener('ended', onPause);
        };
    }, [audioSrc]);
    
    const handleTimeChange = (field: 'start' | 'end', value: number) => {
        setTimeSelection(prev => {
            const newSelection = { ...prev, [field]: value };
            if (newSelection.start > newSelection.end) {
                if (field === 'start') newSelection.end = newSelection.start;
                else newSelection.start = newSelection.end;
            }
            return newSelection;
        });
    };

    return (
        <div className="content-panel">
            <div className="media-container">
                <div className="controls">
                    <p>Carga un audio para analizar</p>
                    <label className="file-input-label" htmlFor="audio-upload">Seleccionar Archivo</label>
                    <input id="audio-upload" type="file" accept="audio/*" onChange={handleFileChange} />
                </div>
                <div className="media-visual">
                    <canvas ref={canvasRef} className="waveform-canvas" width="400" height="250"></canvas>
                </div>
                 <div className="media-actions">
                    <button className="action-button" onClick={togglePlay} disabled={!audioSrc}>
                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        {isPlaying ? 'Pausa' : 'Play'}
                    </button>
                    <button className="action-button" onClick={handleStop} disabled={!audioSrc}><StopIcon /> Stop</button>
                    {audioSrc && <audio ref={audioRef} src={audioSrc} style={{ display: 'none' }} />}
                </div>
                {audioSrc && (
                     <div className="selection-controls full-width">
                        <h4>Controles de Visualización</h4>
                         <div className="control-row">
                            <label>Inicio: {timeSelection.start.toFixed(3)}s</label>
                            <input type="range" min="0" max={duration} step="0.001" value={timeSelection.start} onChange={e => handleTimeChange('start', parseFloat(e.target.value))} />
                        </div>
                        <div className="control-row">
                            <label>Fin: {timeSelection.end.toFixed(3)}s</label>
                            <input type="range" min="0" max={duration} step="0.001" value={timeSelection.end} onChange={e => handleTimeChange('end', parseFloat(e.target.value))} />
                        </div>
                     </div>
                )}
                <button className="view-data-button" onClick={toggleShowData} disabled={!audioSrc}>
                    {showData ? 'Ocultar Datos Numéricos' : 'Ver Datos Numéricos'}
                </button>
            </div>
            <div className="data-container">
                 <h3>Representación de Audio</h3>
                <p>El audio es un arreglo de "muestras" de amplitud. Selecciona un rango de tiempo para ver las muestras individuales como un gráfico y como datos numéricos.</p>
                <h4>Visualización de Muestras</h4>
                <AudioSampleChart samples={selectedSamples} />
                <h4>Datos Numéricos de la Selección</h4>
                <div className="data-representation">
                    <CodeBlock code={showData ? dataRepresentation : '// Haz clic en "Ver Datos Numéricos" para ver las muestras...'} />
                </div>
            </div>
        </div>
    );
};


const App = () => {
    const [activeTab, setActiveTab] = useState<Tab>('image');

    const renderContent = () => {
        switch (activeTab) {
            case 'image': return <ImagePanel />;
            case 'video': return <VideoPanel />;
            case 'audio': return <AudioPanel />;
            default: return null;
        }
    };

    return (
        <div className="app-container">
            <header>
                <h1>Visualizador de Representación de Medios</h1>
                <p>Explora cómo las imágenes, videos y audios se almacenan como números en una computadora.</p>
            </header>
            <div className="tabs">
                <button
                    className={`tab-button ${activeTab === 'image' ? 'active' : ''}`}
                    onClick={() => setActiveTab('image')}
                    aria-pressed={activeTab === 'image'}
                >
                    Imagen
                </button>
                <button
                    className={`tab-button ${activeTab === 'video' ? 'active' : ''}`}
                    onClick={() => setActiveTab('video')}
                    aria-pressed={activeTab === 'video'}
                >
                    Video
                </button>
                <button
                    className={`tab-button ${activeTab === 'audio' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audio')}
                    aria-pressed={activeTab === 'audio'}
                >
                    Audio
                </button>
            </div>
            <main>
                {renderContent()}
            </main>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);