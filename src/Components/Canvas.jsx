import React, { useEffect, useRef, useState, useCallback } from "react";
import { SketchPicker } from "react-color";
import "./Canvas.css";


import undoIcon from "./undo (1).png";     
import redoIcon from "./redo-arrow.png";   

const Canvas = () => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState("brush");
  const [color, setColor] = useState("#000000"); // opak HEX
  const [brushSize, setBrushSize] = useState(5);

  // Şekil modu: rectangle | circle | triangle | null
  const [shape, setShape] = useState(null);
  const [fill, setFill] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });

  // Geçmiş ve Redo yığını
  const [items, setItems] = useState([]);         // [{type:'path'|'shape', ...}]
  const [redoStack, setRedoStack] = useState([]); // ileri alma
  const itemsRef = useRef(items);
  const redoRef = useRef(redoStack);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { redoRef.current = redoStack; }, [redoStack]);

  // Anlık path
  const [currentPath, setCurrentPath] = useState([]);
  const currentPathRef = useRef(currentPath);
  useEffect(() => { currentPathRef.current = currentPath; }, [currentPath]);

  // Canvas kurulumu (DPR uyumlu)
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const cssWidth = canvas.parentElement?.clientWidth || window.innerWidth;
    const cssHeight = window.innerHeight;

    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    setupCanvas();
    redrawAll([]);

    const onResize = () => {
      setupCanvas();
      redrawAll(itemsRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupCanvas]);

  // Anlık araç ayarları
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.lineWidth = Number(brushSize) || 1;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
  }, [color, brushSize, tool]);

  // Kısayollar: Undo / Redo / Esc (şekil iptal)
  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        redo();
      } else if (k === "escape") {
        if (isDrawing) {
          setIsDrawing(false);
          redrawAll();
        }
        setShape(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDrawing]);

  // === Yardımcılar ===
  const clearAll = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawPath = (path, strokeColor, width, composite = "source-over") => {
    const ctx = ctxRef.current;
    if (!ctx || path.length === 0) return;
    const prevC = ctx.globalCompositeOperation;
    const prevW = ctx.lineWidth;
    const prevS = ctx.strokeStyle;

    ctx.globalCompositeOperation = composite;
    ctx.lineWidth = width;
    ctx.strokeStyle = strokeColor;

    ctx.beginPath();
    path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    ctx.globalCompositeOperation = prevC;
    ctx.lineWidth = prevW;
    ctx.strokeStyle = prevS;
  };

  const drawShape = (x, y, w, h, type, hexColor, doFill, width = brushSize) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    const ps = ctx.strokeStyle, pf = ctx.fillStyle, pw = ctx.lineWidth, pc = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = hexColor;
    ctx.fillStyle = hexColor;
    ctx.lineWidth = width;

    ctx.beginPath();
    if (type === "rectangle") {
      doFill ? ctx.fillRect(x, y, w, h) : ctx.strokeRect(x, y, w, h);
    } else if (type === "circle") {
      ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
      doFill ? ctx.fill() : ctx.stroke();
    } else if (type === "triangle") {
      const x1 = x + w / 2, y1 = y;
      const x2 = x + w, y2 = y + h;
      const x3 = x, y3 = y + h;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.closePath();
      doFill ? ctx.fill() : ctx.stroke();
    }

    ctx.strokeStyle = ps; ctx.fillStyle = pf; ctx.lineWidth = pw; ctx.globalCompositeOperation = pc;
  };

  const redrawAll = (src = itemsRef.current) => {
    clearAll();
    src.forEach((it) => {
      if (it.type === "path") {
        drawPath(it.points, it.color, it.width, it.composite);
      } else if (it.type === "shape") {
        drawShape(it.x, it.y, it.w, it.h, it.shape, it.color, it.fill, it.width);
      }
    });
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const cy = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    return { x: cx, y: cy };
  };

  const addItem = (item) => {
    const next = [...itemsRef.current, item];
    setItems(next);
    setRedoStack([]); // yeni hamlede redo temizlenir
    redrawAll(next);
  };

  // === Pointer olayları ===
  const onPointerDown = (e) => {
    e.preventDefault();
    const pos = getPos(e);
    if (shape) {
      startRef.current = pos;
      setIsDrawing(true);
      return;
    }
    setIsDrawing(true);
    setCurrentPath([{ x: pos.x, y: pos.y }]);
    const ctx = ctxRef.current;
    if (ctx) { ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
  };

  const onPointerMove = (e) => {
    if (!isDrawing) return;
    const pos = getPos(e);

    if (shape) {
      const { x, y } = startRef.current;
      const w = pos.x - x, h = pos.y - y;
      redrawAll(); // geçmişi çiz
      drawShape(x, y, w, h, shape, color, fill, Number(brushSize) || 1); // canlı önizleme
      return;
    }

    setCurrentPath((prev) => {
      const next = [...prev, { x: pos.x, y: pos.y }];
      const ctx = ctxRef.current;
      if (ctx) { ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
      return next;
    });
  };

  const onPointerUp = (e) => {
    if (!isDrawing) return;

    if (shape) {
      const end = getPos(e);
      const { x, y } = startRef.current;
      const w = end.x - x, h = end.y - y;

      if (Math.abs(w) > 0.5 || Math.abs(h) > 0.5) {
        addItem({
          type: "shape",
          shape,
          x, y, w, h,
          color,
          fill,
          width: Number(brushSize) || 1,
        });
      } else {
        redrawAll(); // minik sürükleme: sadece önizlemeyi sil
      }

      setIsDrawing(false);
      // şekil seçimi sende kalır; iptal etmedikçe arka arkaya çizebilirsin
      return;
    }

    addItem({
      type: "path",
      points: currentPathRef.current,
      color,
      width: Number(brushSize) || 1,
      composite: tool === "eraser" ? "destination-out" : "source-over",
    });
    setIsDrawing(false);
    setCurrentPath([]);
  };

  // Undo / Redo
  const undo = () => {
    if (isDrawing) return;
    const cur = itemsRef.current;
    if (cur.length === 0) return;
    const next = cur.slice(0, -1);
    const popped = cur[cur.length - 1];
    setItems(next);
    setRedoStack((r) => [...r, popped]);
    redrawAll(next);
  };

  const redo = () => {
    if (isDrawing) return;
    const r = redoRef.current;
    if (r.length === 0) return;
    const nextRedo = r.slice(0, -1);
    const item = r[r.length - 1];
    setRedoStack(nextRedo);
    const merged = [...itemsRef.current, item];
    setItems(merged);
    redrawAll(merged);
  };

  // Handlers
  const handleColorChange = (c) => setColor(c.hex);
  const handleBrushSize = (e) => setBrushSize(parseInt(e.target.value, 10));

  const clearCanvas = () => {
    clearAll();
    setItems([]);
    setRedoStack([]);
    const ctx = ctxRef.current;
    if (ctx) ctx.globalCompositeOperation = "source-over";
  };

  const saveAsImage = () => {
    const canvas = canvasRef.current;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = "sketch.png";
    a.click();
  };

  // toggle shape (aynı butona basınca kapat)
  const toggleShape = (s) => {
    setShape((prev) => {
      const next = prev === s ? null : s;
      if (next) setTool("brush"); // şekiller fırça ayarını kullanır
      return next;
    });
  };

  return (
    <div className="sp-app" onContextMenu={(e) => e.preventDefault()}>
      <div className="sp-sidebar">
        <h3>History</h3>
        <div className="sp-icon-row">
          <button
            type="button"
            className="sp-icon-btn"
            onClick={undo}
            disabled={items.length === 0}
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
          >
            <img src={undoIcon} alt="" />
          </button>
          <button
            type="button"
            className="sp-icon-btn"
            onClick={redo}
            disabled={redoStack.length === 0}
            title="Redo (Ctrl/Cmd+Y)"
            aria-label="Redo"
          >
            <img src={redoIcon} alt="" />
          </button>
        </div>

        <h3>Shapes</h3>
        <div className="sp-control">
          <input type="radio" id="sp-rectangle" name="sp-shape"
                 checked={shape === "rectangle"} onClick={() => toggleShape("rectangle")} readOnly />
          <label htmlFor="sp-rectangle">Rectangle</label>
        </div>
        <div className="sp-control">
          <input type="radio" id="sp-circle" name="sp-shape"
                 checked={shape === "circle"} onClick={() => toggleShape("circle")} readOnly />
          <label htmlFor="sp-circle">Circle</label>
        </div>
        <div className="sp-control">
          <input type="radio" id="sp-triangle" name="sp-shape"
                 checked={shape === "triangle"} onClick={() => toggleShape("triangle")} readOnly />
          <label htmlFor="sp-triangle">Triangle</label>
        </div>
        <div className="sp-control">
          <input type="checkbox" id="sp-fill"
                 checked={fill} onChange={() => setFill((f) => !f)} />
          <label htmlFor="sp-fill">Fill color</label>
        </div>
        <button
          type="button"
          onClick={() => { setShape(null); setIsDrawing(false); redrawAll(); }}
          style={{ marginTop: 6, background: "#6b7280" }}
        >
          Cancel shape (Esc)
        </button>

        <h3>Options</h3>
        <div className="sp-control">
          <input type="radio" id="sp-brush" name="sp-tool"
                 checked={tool === "brush"} onChange={() => setTool("brush")} />
          <label htmlFor="sp-brush">Brush</label>
        </div>
        <div className="sp-control">
          <input type="radio" id="sp-eraser" name="sp-tool"
                 checked={tool === "eraser"} onChange={() => setTool("eraser")} />
          <label htmlFor="sp-eraser">Eraser</label>
        </div>

        <div className="sp-control">
          <label htmlFor="sp-size">Brush size: {brushSize}px</label>
          <input id="sp-size" type="range" min="1" max="40"
                 value={brushSize} onChange={handleBrushSize} />
        </div>

        <button onClick={clearCanvas}>Clear Canvas</button>
        <button onClick={saveAsImage}>Save As Image</button>

        <div className="sp-color-picker">
          <h3>Colors</h3>
          <SketchPicker color={color} onChange={handleColorChange} disableAlpha />
        </div>

        
      </div>

      <canvas
        ref={canvasRef}
        className="sp-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
    </div>
  );
};

export default Canvas;
