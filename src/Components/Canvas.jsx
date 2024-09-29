import React, { useRef, useState, useEffect } from 'react';
import { SketchPicker } from 'react-color';
import './Canvas.css';

const Canvas = () => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(5);
  const [shape, setShape] = useState(null); // Track the selected shape
  const [fill, setFill] = useState(false);

  const [startX, setStartX] = useState(null); // Starting X position
  const [startY, setStartY] = useState(null); // Starting Y position
  const [shapes, setShapes] = useState([]); // History of shapes and brush strokes
  const [currentBrushStroke, setCurrentBrushStroke] = useState([]); // Track current brush stroke

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = window.innerWidth * 2;
    canvas.height = window.innerHeight * 2;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.lineCap = 'round';
    contextRef.current = context;
  }, []);

  useEffect(() => {
    const context = contextRef.current;

    if (tool === 'eraser') {
      // Switch to eraser mode
      context.globalCompositeOperation = 'destination-out';
    } else {
      // Switch to drawing mode
      context.globalCompositeOperation = 'source-over';
      context.strokeStyle = color; // Set brush color
    }

    context.lineWidth = brushSize;
  }, [color, brushSize, tool]);

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;

    if (shape) {
      setStartX(offsetX); // Set initial starting position for shape
      setStartY(offsetY);
      setIsDrawing(true);
    } else {
      contextRef.current.beginPath();
      contextRef.current.moveTo(offsetX, offsetY);
      setCurrentBrushStroke([{ x: offsetX, y: offsetY }]); // Track brush start position
      setIsDrawing(true);
    }
  };

  const finishDrawing = ({ nativeEvent }) => {
    if (shape) {
      const { offsetX, offsetY } = nativeEvent;
      const width = offsetX - startX;
      const height = offsetY - startY;
      
      // Add shape to the shapes array (history) with its fill status
      setShapes([...shapes, { type: 'shape', shape, x: startX, y: startY, width, height, fill, color }]);

      setIsDrawing(false);
      setShape(null); // Reset shape after drawing
    } else {
      // Add completed brush stroke to the shapes array
      setShapes([...shapes, { type: 'brush', points: currentBrushStroke, color, brushSize }]);

      contextRef.current.closePath();
      setIsDrawing(false);
    }
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;

    const { offsetX, offsetY } = nativeEvent;

    if (shape) {
      const width = offsetX - startX; // Calculate width from drag
      const height = offsetY - startY; // Calculate height from drag

      // Clear only the part of the canvas where the current shape is being drawn
      contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      redrawCanvas(); // Redraw the previously drawn shapes and brush strokes

      drawShape(startX, startY, width, height); // Draw shape based on drag size
    } else {
      // Add point to the current brush stroke
      setCurrentBrushStroke([...currentBrushStroke, { x: offsetX, y: offsetY }]);

      contextRef.current.lineTo(offsetX, offsetY);
      contextRef.current.stroke();
    }
  };

  const drawShape = (x, y, width, height, shapeType = shape, fillColor = color, shapeFill = fill) => {
    const context = contextRef.current;

    context.beginPath();

    if (shapeType === 'rectangle') {
      context.rect(x, y, width, height); // Draw rectangle based on drag size
    } else if (shapeType === 'circle') {
      const radius = Math.sqrt(width ** 2 + height ** 2) / 2; // Calculate radius from diagonal drag
      context.arc(x, y, radius, 0, 2 * Math.PI); // Draw circle with calculated radius
    } else if (shapeType === 'triangle') {
      context.moveTo(x, y); // Top point
      context.lineTo(x + width / 2, y + height); // Bottom right
      context.lineTo(x - width / 2, y + height); // Bottom left
      context.closePath();
    }

    if (shapeFill) {
      context.fillStyle = fillColor;
      context.fill();
    } else {
      context.strokeStyle = fillColor;
      context.stroke();
    }
  };

  const redrawCanvas = () => {
    // Loop through the shapes array and redraw each shape/brush stroke
    shapes.forEach(({ type, shape, x, y, width, height, fill, color, brushSize, points }) => {
      if (type === 'shape') {
        drawShape(x, y, width, height, shape, color, fill);
      } else if (type === 'brush') {
        redrawBrush(points, color, brushSize);
      }
    });
  };

  const redrawBrush = (points, color, brushSize) => {
    const context = contextRef.current;
    context.strokeStyle = color;
    context.lineWidth = brushSize;

    context.beginPath();
    points.forEach((point, index) => {
      const { x, y } = point;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.stroke();
  };

  const handleColorChange = (color) => {
    setColor(color.hex);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setShapes([]); // Clear the shape history
  };

  const saveAsImage = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = 'sketch.png';
    link.click();
  };

  const handleShapeClick = (shape) => {
    setShape(shape); // Set the selected shape
  };

  return (
    <div className="app">
      <div className="sidebar">
        <h3>Shapes</h3>
        <div>
          <input type="radio" id="rectangle" name="shape" onClick={() => handleShapeClick('rectangle')} />
          <label htmlFor="rectangle">Rectangle</label>
        </div>
        <div>
          <input type="radio" id="circle" name="shape" onClick={() => handleShapeClick('circle')} />
          <label htmlFor="circle">Circle</label>
        </div>
        <div>
          <input type="radio" id="triangle" name="shape" onClick={() => handleShapeClick('triangle')} />
          <label htmlFor="triangle">Triangle</label>
        </div>
        <div>
          <input type="checkbox" id="fill" onChange={() => setFill(!fill)} />
          <label htmlFor="fill">Fill color</label>
        </div>

        <h3>Options</h3>
        <div>
          <input type="radio" id="brush" name="tool" onClick={() => setTool('brush')} />
          <label htmlFor="brush">Brush</label>
        </div>
        <div>
          <input type="radio" id="eraser" name="tool" onClick={() => setTool('eraser')} />
          <label htmlFor="eraser">Eraser</label>
        </div>

        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => setBrushSize(e.target.value)}
        />

        <button onClick={clearCanvas}>Clear Canvas</button>
        <button onClick={saveAsImage}>Save As Image</button>

        <div className="color-picker">
          <h3>Colors</h3>
          <SketchPicker color={color} onChange={handleColorChange} />
        </div>
      </div>

      <canvas
        onMouseDown={startDrawing}
        onMouseUp={finishDrawing}
        onMouseMove={draw}
        ref={canvasRef}
        style={{ border: '2px solid black' }}
      />
    </div>
  );
};

export default Canvas;
