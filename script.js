let placedStages = [];


const gridSize = 15;
let stageIdCounter = 0;
let currentOrientation = 'horizontal';
let currentDragData = null;
let dragPreview = null;
let tapSelectedElement = null;
let pointerDragState = null;
let suppressOverlayClickId = null;
let suppressActiveStageClick = false;

const pointerDragThreshold = 8;
const transparentDragImage = new Image();
transparentDragImage.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function getStageColorStyle(data) {
    const height = parseInt(data.height) || 20;
    const heightIndex = { 20: 0, 40: 1, 60: 2, 80: 3 }[height] ?? 0;
    const palette = data.width === 115
        ? ['#fef08a', '#facc15', '#eab308', '#ca8a04']
        : ['#bbf7d0', '#86efac', '#4ade80', '#22c55e'];

    return {
        fill: palette[heightIndex],
        border: data.width === 115 ? '#854d0e' : '#166534',
        shadow: data.width === 115 ? 'rgba(234, 179, 8, 0.4)' : 'rgba(34, 197, 94, 0.35)',
        text: '#1e293b'
    };
}

function createGrid() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    grid.style.position = 'relative';

    for (let i = 0; i < gridSize * gridSize; i++) {
        const cell = document.createElement('div');
        cell.classList.add('grid-cell');
        cell.dataset.index = i;

        cell.addEventListener('dragover', dragOver);
        cell.addEventListener('dragleave', dragLeave);
        cell.addEventListener('drop', dropStage);
        cell.addEventListener('click', tapPlaceStage);

        grid.appendChild(cell);
    }

    dragPreview = document.createElement('div');
    dragPreview.id = 'drag-preview';
    document.body.appendChild(dragPreview);
}

function setupRotateButton() {
    const rotateBtn = document.getElementById('rotate-btn');
    rotateBtn.addEventListener('click', () => {
        currentOrientation = currentOrientation === 'horizontal' ? 'vertical' : 'horizontal';
        rotateBtn.textContent = currentOrientation === 'horizontal'
            ? "🔄 หมุนเวที 115 cm (แนวนอน)"
            : "🔄 หมุนเวที 115 cm (แนวตั้ง)";
    });
}

function getActiveStageData() {
    const option = document.getElementById('active-stage-draggable');
    if (!option) return null;

    return {
        width: parseInt(option.dataset.width),
        height: parseInt(option.dataset.height),
        priceLite: parseInt(option.dataset.lite),
        pricePro: parseInt(option.dataset.pro)
    };
}

function setTapSelection(element) {
    if (tapSelectedElement) tapSelectedElement.classList.remove('tap-selected');
    tapSelectedElement = element || null;
    if (tapSelectedElement) tapSelectedElement.classList.add('tap-selected');
}

function clearTapSelection() {
    setTapSelection(null);
    if (currentDragData && currentDragData.isTapPlacement) {
        currentDragData = null;
    }
}

function selectActiveStageForTap(e) {
    if (suppressActiveStageClick) {
        suppressActiveStageClick = false;
        return;
    }

    if (e && e.target.closest('.price-btn')) return;

    const activeStage = document.getElementById('active-stage-draggable');
    if (tapSelectedElement === activeStage && currentDragData && currentDragData.isTapPlacement) {
        clearTapSelection();
        return;
    }

    const data = getActiveStageData();
    if (!data) return;

    currentDragData = {
        ...data,
        isTapPlacement: true
    };
    setTapSelection(activeStage);
}

function tapPlaceStage(e) {
    if (!currentDragData || !currentDragData.isTapPlacement) return;

    const startIndex = parseInt(e.currentTarget.dataset.index);
    placeStage(currentDragData, startIndex, currentOrientation);
}

function setupTapPlacementCancel() {
    document.addEventListener('click', (e) => {
        if (!currentDragData || !currentDragData.isTapPlacement) return;
        if (e.target.closest('#active-stage-draggable')) return;
        if (e.target.closest('#grid')) return;

        clearTapSelection();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') clearTapSelection();
    });
}

function dragStart(e) {
    const option = e.currentTarget;
    currentDragData = {
        width: parseInt(option.dataset.width),
        height: parseInt(option.dataset.height),
        priceLite: parseInt(option.dataset.lite),
        pricePro: parseInt(option.dataset.pro)
    };

    setTapSelection(null);
    e.dataTransfer.setData('text/plain', JSON.stringify(currentDragData));
    e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
    option.classList.add('dragging');
    updateDragPreview();
}

function dragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    clearDragHighlights();
    if (currentDragData && !currentDragData.isTapPlacement) currentDragData = null;
    hideDragPreview();
}

function updateDragPreview() {
    if (!currentDragData || !dragPreview) return;

    const is115 = currentDragData.width === 115;
    const dragOrient = currentDragData.isExisting ? currentDragData.orientation : currentOrientation;
    const w = (is115 && dragOrient === 'horizontal') ? 2 : 1;
    const h = (is115 && dragOrient === 'vertical') ? 2 : 1;
    const colorStyle = getStageColorStyle(currentDragData);

    dragPreview.style.width = `${w * 48 + (w - 1) * 3}px`;
    dragPreview.style.height = `${h * 48 + (h - 1) * 3}px`;
    dragPreview.style.backgroundColor = colorStyle.fill;
    dragPreview.style.borderColor = colorStyle.border;
    dragPreview.style.boxShadow = `0 0 0 3px ${colorStyle.shadow}`;
    dragPreview.style.color = colorStyle.text;
    dragPreview.style.display = 'flex';
    dragPreview.textContent = `${currentDragData.height}cm`;
}

function hideDragPreview() {
    if (dragPreview) dragPreview.style.display = 'none';
}

function getCellFromPoint(clientX, clientY) {
    const element = document.elementFromPoint(clientX, clientY);
    return element ? element.closest('.grid-cell') : null;
}

function restoreExistingStageVisual(stageId) {
    const stage = placedStages.find(s => s.id === stageId);
    if (!stage) return;

    stage.cells.forEach(idx => {
        const cell = document.querySelector(`.grid-cell[data-index="${idx}"]`);
        if (!cell) return;

        cell.classList.add('occupied');
        cell.style.border = '1px solid transparent';
        cell.style.boxShadow = 'none';
        cell.style.backgroundColor = 'transparent';
    });

    if (stage.overlay) stage.overlay.style.display = 'flex';
}

function beginPointerDrag(e, data, options = {}) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.pointerType === 'mouse') return;

    pointerDragState = {
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        data,
        started: false,
        isExisting: Boolean(options.isExisting),
        stageId: options.stageId || null,
        orientation: options.orientation || currentOrientation,
        originalStartIndex: options.originalStartIndex !== undefined ? options.originalStartIndex : null
    };

    document.addEventListener('pointermove', pointerDragMove);
    document.addEventListener('pointerup', pointerDragEnd);
    document.addEventListener('pointercancel', pointerDragCancel);
}

function startPointerDragIfNeeded() {
    if (!pointerDragState || pointerDragState.started) return;

    const dx = pointerDragState.lastX - pointerDragState.startX;
    const dy = pointerDragState.lastY - pointerDragState.startY;
    if (Math.sqrt((dx * dx) + (dy * dy)) < pointerDragThreshold) return;

    pointerDragState.started = true;
    currentDragData = {
        ...pointerDragState.data,
        isExisting: pointerDragState.isExisting,
        stageId: pointerDragState.stageId,
        orientation: pointerDragState.orientation
    };
    setTapSelection(null);

    if (pointerDragState.isExisting) {
        const stage = placedStages.find(s => s.id === pointerDragState.stageId);
        if (stage) {
            stage.cells.forEach(idx => {
                const cell = document.querySelector(`.grid-cell[data-index="${idx}"]`);
                if (!cell) return;

                cell.classList.remove('occupied');
                cell.style.border = '';
                cell.style.boxShadow = '';
                cell.style.backgroundColor = '';
            });
            if (stage.overlay) stage.overlay.style.display = 'none';
        }
    }

    updateDragPreview();
}

function pointerDragMove(e) {
    if (!pointerDragState) return;

    pointerDragState.lastX = e.clientX;
    pointerDragState.lastY = e.clientY;
    startPointerDragIfNeeded();

    if (!pointerDragState.started || !dragPreview) return;

    e.preventDefault();
    dragPreview.style.left = `${e.pageX + 20}px`;
    dragPreview.style.top = `${e.pageY + 20}px`;
}

function finishPointerDrag() {
    document.removeEventListener('pointermove', pointerDragMove);
    document.removeEventListener('pointerup', pointerDragEnd);
    document.removeEventListener('pointercancel', pointerDragCancel);
}

function pointerDragEnd(e) {
    if (!pointerDragState) return;

    finishPointerDrag();

    if (!pointerDragState.started) {
        pointerDragState = null;
        return;
    }

    e.preventDefault();
    const state = pointerDragState;
    pointerDragState = null;

    const trashBin = document.getElementById('trash-bin');
    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
    const droppedOnTrash = trashBin && dropTarget && trashBin.contains(dropTarget);

    if (state.isExisting && droppedOnTrash) {
        removeStage(state.stageId);
        calculateTotal(true);
        currentDragData = null;
        hideDragPreview();
        suppressOverlayClickId = state.stageId;
        return;
    }

    const cell = getCellFromPoint(e.clientX, e.clientY);
    if (cell) {
        const startIndex = parseInt(cell.dataset.index);
        if (state.isExisting) removeStage(state.stageId);

        const success = placeStage(state.data, startIndex, state.orientation);
        if (!success && state.isExisting) {
            placeStage(state.data, state.originalStartIndex, state.orientation);
        }
    } else if (state.isExisting) {
        restoreExistingStageVisual(state.stageId);
    }

    currentDragData = null;
    hideDragPreview();
    suppressActiveStageClick = !state.isExisting;
    suppressOverlayClickId = state.stageId;
}

function pointerDragCancel() {
    if (pointerDragState && pointerDragState.isExisting && pointerDragState.started) {
        restoreExistingStageVisual(pointerDragState.stageId);
    }

    finishPointerDrag();
    pointerDragState = null;
    currentDragData = null;
    hideDragPreview();
}

function dragOver(e) {
    e.preventDefault();
    if (!currentDragData) return;

    updateDragHighlights(parseInt(e.currentTarget.dataset.index));

    dragPreview.style.left = `${e.pageX + 20}px`;
    dragPreview.style.top = `${e.pageY + 20}px`;
}

function dragLeave(e) {
    if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('#grid')) clearDragHighlights();
}

function dropStage(e) {
    e.preventDefault();
    const cell = e.currentTarget;
    clearDragHighlights();
    hideDragPreview();

    if (!currentDragData) return;

    const startIndex = parseInt(cell.dataset.index);
    const dragOrient = currentDragData.isExisting ? currentDragData.orientation : currentOrientation;
    const dataToPlace = {
        width: currentDragData.width,
        height: currentDragData.height,
        priceLite: currentDragData.priceLite,
        pricePro: currentDragData.pricePro
    };
    const originalStartIndex = currentDragData.originalStartIndex;
    const originalOrientation = currentDragData.orientation;
    const isExisting = currentDragData.isExisting;

    if (isExisting) {
        removeStage(currentDragData.stageId);
    }

    const success = placeStage(dataToPlace, startIndex, dragOrient);
    if (!success && isExisting && originalStartIndex !== undefined) {
        placeStage(dataToPlace, originalStartIndex, originalOrientation);
    }

    if (success) {
        currentDragData = null;
    }
}

function getDragFootprint(data, orientation) {
    return {
        w: (data.width === 115 && orientation === 'horizontal') ? 2 : 1,
        h: (data.width === 115 && orientation === 'vertical') ? 2 : 1
    };
}

function clearDragHighlights() {
    document.querySelectorAll('.grid-cell.dragover, .grid-cell.dragover-invalid').forEach(cell => {
        cell.classList.remove('dragover', 'dragover-invalid');
    });
}

function updateDragHighlights(startIndex) {
    clearDragHighlights();

    const row = Math.floor(startIndex / gridSize);
    const col = startIndex % gridSize;
    const dragOrient = currentDragData.isExisting ? currentDragData.orientation : currentOrientation;
    const { w, h } = getDragFootprint(currentDragData, dragOrient);
    const isOutOfBounds = col + w > gridSize || row + h > gridSize;
    let isBlocked = false;
    const cells = [];

    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            const targetRow = row + r;
            const targetCol = col + c;
            if (targetRow >= gridSize || targetCol >= gridSize) continue;

            const cell = document.querySelector(`.grid-cell[data-index="${targetRow * gridSize + targetCol}"]`);
            if (!cell) continue;
            if (cell.classList.contains('occupied')) isBlocked = true;
            cells.push(cell);
        }
    }

    const highlightClass = isOutOfBounds || isBlocked ? 'dragover-invalid' : 'dragover';
    cells.forEach(cell => cell.classList.add(highlightClass));
}

function removeStage(id) {
    const stageIndex = placedStages.findIndex(s => s.id === id);
    if (stageIndex === -1) return;
    const stage = placedStages[stageIndex];
    stage.cells.forEach(idx => {
        const cell = document.querySelector(`.grid-cell[data-index="${idx}"]`);
        if (cell) {
            cell.classList.remove('occupied');
            cell.style.border = '';
            cell.style.boxShadow = '';
            cell.style.backgroundColor = '';
        }
    });
    if (stage.overlay) stage.overlay.remove();
    placedStages.splice(stageIndex, 1);
}

function rotatePlacedStage(id) {
    const stage = placedStages.find(s => s.id === id);
    if (!stage || stage.data.width === 60) return;

    stage.cells.forEach(idx => {
        const cell = document.querySelector(`.grid-cell[data-index="${idx}"]`);
        cell.classList.remove('occupied');
        cell.style.border = '';
        cell.style.boxShadow = '';
        cell.style.backgroundColor = '';
    });

    const newOrientation = stage.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    const w = newOrientation === 'horizontal' ? 2 : 1;
    const h = newOrientation === 'vertical' ? 2 : 1;

    let canPlace = true;
    if (stage.col + w > gridSize || stage.row + h > gridSize) canPlace = false;
    else {
        for (let r = 0; r < h; r++) {
            for (let c = 0; c < w; c++) {
                const idx = (stage.row + r) * gridSize + (stage.col + c);
                const target = document.querySelector(`.grid-cell[data-index="${idx}"]`);
                if (!target || target.classList.contains('occupied')) {
                    canPlace = false; break;
                }
            }
        }
    }

    if (canPlace) {
        const data = stage.data;
        const startIndex = stage.row * gridSize + stage.col;
        removeStage(id);
        placeStage(data, startIndex, newOrientation);
    } else {
        stage.cells.forEach(idx => {
            const cell = document.querySelector(`.grid-cell[data-index="${idx}"]`);
            cell.classList.add('occupied');
            cell.style.border = '1px solid transparent';
            cell.style.boxShadow = 'none';
            cell.style.backgroundColor = 'transparent';
        });
        alert("ไม่สามารถหมุนได้ พื้นที่ถูกใช้งานแล้วหรือติดขอบ");
    }
}

function placeStage(data, startIndex, orientation) {
    const row = Math.floor(startIndex / gridSize);
    const col = startIndex % gridSize;

    const w = (data.width === 115 && orientation === 'horizontal') ? 2 : 1;
    const h = (data.width === 115 && orientation === 'vertical') ? 2 : 1;

    if (col + w > gridSize || row + h > gridSize) {
        alert("ไม่สามารถวางเกินขอบได้");
        return false;
    }

    const cellsToOccupy = [];
    let canPlace = true;

    for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
            const idx = (row + r) * gridSize + (col + c);
            const target = document.querySelector(`.grid-cell[data-index="${idx}"]`);
            if (!target || target.classList.contains('occupied')) {
                canPlace = false;
                break;
            }
            cellsToOccupy.push(idx);
        }
        if (!canPlace) break;
    }

    if (!canPlace) {
        alert("พื้นที่นี้ถูกใช้งานแล้ว");
        return false;
    }

    const colorStyle = getStageColorStyle(data);

    cellsToOccupy.forEach(idx => {
        const target = document.querySelector(`.grid-cell[data-index="${idx}"]`);
        target.classList.add('occupied');
        target.style.border = '1px solid transparent';
        target.style.boxShadow = 'none';
        target.style.backgroundColor = 'transparent';
        target.textContent = '';
    });

    const overlay = document.createElement('div');
    overlay.className = 'stage-overlay';
    overlay.style.position = 'absolute';
    overlay.style.left = `${15 + col * 51}px`;
    overlay.style.top = `${15 + row * 51}px`;
    overlay.style.width = `${w * 48 + (w - 1) * 3}px`;
    overlay.style.height = `${h * 48 + (h - 1) * 3}px`;
    overlay.style.backgroundColor = colorStyle.fill;
    overlay.style.border = `3px solid ${colorStyle.border}`;
    overlay.style.boxShadow = `0 0 0 3px ${colorStyle.shadow}`;
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.fontWeight = '700';
    overlay.style.fontSize = '14px';
    overlay.style.color = colorStyle.text;
    overlay.style.pointerEvents = 'auto';
    overlay.style.zIndex = '10';
    overlay.style.boxSizing = 'border-box';

    const sizeText = data.width === 115 ? '115x60' : '60x60';
    overlay.innerHTML = `<div style="text-align:center; line-height:1.2;">${sizeText}<br><span style="font-size:11px">(${data.height}cm)</span></div>`;

    document.getElementById('grid').appendChild(overlay);

    stageIdCounter++;
    const currentId = stageIdCounter;

    overlay.style.cursor = 'grab';
    overlay.title = 'คลิกเพื่อหมุน / ลากเพื่อย้ายหรือลบ';
    overlay.draggable = true;

    overlay.addEventListener('pointerdown', (e) => {
        const stage = placedStages.find(s => s.id === currentId);
        if (!stage) return;

        beginPointerDrag(e, stage.data, {
            isExisting: true,
            stageId: currentId,
            orientation: stage.orientation,
            originalStartIndex: stage.row * gridSize + stage.col
        });
    });

    overlay.addEventListener('dragstart', (e) => {
        const stage = placedStages.find(s => s.id === currentId);
        if (!stage) return;
        currentDragData = {
            ...stage.data,
            isExisting: true,
            stageId: currentId,
            orientation: stage.orientation,
            originalStartIndex: stage.row * gridSize + stage.col
        };
        e.dataTransfer.setData('text/plain', 'existing');
        e.dataTransfer.setDragImage(transparentDragImage, 0, 0);
        stage.cells.forEach(idx => {
            const cell = document.querySelector(`.grid-cell[data-index="${idx}"]`);
            cell.classList.remove('occupied');
            cell.style.border = '';
            cell.style.boxShadow = '';
            cell.style.backgroundColor = '';
        });
        setTimeout(() => overlay.style.display = 'none', 0);
        updateDragPreview();
    });

    overlay.addEventListener('dragend', (e) => {
        if (currentDragData && currentDragData.isExisting) {
            const stage = placedStages.find(s => s.id === currentDragData.stageId);
            if (stage) {
                stage.cells.forEach(idx => {
                    const cell = document.querySelector(`.grid-cell[data-index="${idx}"]`);
                    cell.classList.add('occupied');
                    cell.style.border = '1px solid transparent';
                    cell.style.boxShadow = 'none';
                    cell.style.backgroundColor = 'transparent';
                });
                stage.overlay.style.display = 'flex';
            }
            currentDragData = null;
        }
        clearDragHighlights();
        hideDragPreview();
    });

    overlay.addEventListener('click', (e) => {
        if (suppressOverlayClickId === currentId) {
            suppressOverlayClickId = null;
            e.preventDefault();
            return;
        }

        rotatePlacedStage(currentId);
    });

    placedStages.push({
        id: currentId,
        data: data,
        orientation: orientation,
        priceLite: data.priceLite,
        pricePro: data.pricePro || data.priceLite,
        cells: cellsToOccupy,
        row: row,
        col: col,
        w: w,
        h: h,
        overlay: overlay
    });
    calculateTotal(true);
    return true;
}

// Functions อื่นๆ
function changeQty(btn, delta) {
    const qtySpan = btn.parentElement.querySelector('.qty');
    let qty = parseInt(qtySpan.textContent) || 0;
    qty = Math.max(0, qty + delta);
    qtySpan.textContent = qty;

    // If user manually edits screws quantity, treat it as user-controlled
    const accEl = btn.closest('.accessory');
    if (accEl && accEl.id === 'acc-screw') {
        window.__userScrewQtyLocked = true;
    } else {
        window.__userScrewQtyLocked = false;
    }

    calculateTotal(false);
}

function updateCornerWarnings(updateAccessoryQty = false) {
    const warningContainer = document.getElementById('warning-container');
    if (!warningContainer) return;


    // Calculate corner collisions (ยังใช้เดิมเพื่อ Plat)
    const vertexMap = {};
    placedStages.forEach(stage => {

        const r = stage.row;
        const c = stage.col;
        const w = stage.w;
        const h = stage.h;

        const corners = [
            `${r},${c}`,
            `${r},${c + w}`,
            `${r + h},${c}`,
            `${r + h},${c + w}`
        ];

        corners.forEach(key => {
            vertexMap[key] = (vertexMap[key] || 0) + 1;
        });
    });

    let plat1 = 0;
    let plat2 = 0;
    let plat3 = 0;
    let plat4 = 0;

    // Plat 1/2/3/4 เดิมจาก vertex collisions
    for (const key in vertexMap) {
        const count = vertexMap[key];
        if (count === 1) plat1++;
        else if (count === 2) plat2++;
        else if (count === 3) plat3++;
        else if (count === 4) plat4++;
    }

    // เพิ่ม Logic Plat1 กลางด้าน 115 (ตามเงื่อนไขใหม่)
    // - ตรวจ orientation เฉพาะ 115*60 เท่านั้น
    // - แนวนอน: ด้าน 115 อยู่บน/ล่าง (เพิ่ม plat1 กลางด้านละ 1 เมื่อด้านนั้นไม่ชน)
    // - แนวตั้ง: ด้าน 115 อยู่ซ้าย/ขวา
    // - นับเฉพาะ “ฝั่งที่ไม่ชนกับตัวอื่น”

    // สร้าง quick lookup: idx -> stage
    function stageHasNeighborOnSide115(stage, dir) {
        // dir for 115-side: horizontal => 'top'/'bottom', vertical => 'left'/'right'
        // ใช้ detectDirFromAToB เพื่อดูว่ามี stage อื่นติดกันด้านนั้นจริงไหม
        for (const other of placedStages) {
            if (other.id === stage.id) continue;
            const dirAtoB = detectDirBetween(stage, other);
            if (!dirAtoB) continue;
            // detectDirBetween ให้ dir จาก A ไป B
            if (dir === dirAtoB) return true;
            // และอีกฝั่งคือ opposite จะชนกันกับ dir ฝั่งตรงข้าม ซึ่งไม่ต้องนับตรงนี้
        }
        return false;
    }

    // ตรวจ “จำนวนการชน” ของ side 115 เฉพาะด้านบน/ล่าง (แนวนอน) หรือซ้าย/ขวา (แนวตั้ง)
    // โดยนับเฉพาะเมื่อ stage เป็น 115 และ “มีเพื่อนติดกัน” ที่ฝั่งนั้นจริง
    // และไม่คิดซ้ำหลายครั้งด้วยการนับเป็นคู่ stageId ที่ติดกันกันจริง
    // plat2 ตามเงื่อนไขใหม่: นับเฉพาะ “side 115 ที่ชนกัน”
    // - horizontal (115-side อยู่ top/bottom): นับ plat2 เฉพาะ top/bottom ที่มีการชน
    // - vertical (115-side อยู่ left/right): นับ plat2 เฉพาะ left/right ที่มีการชน
    // - ถ้าไม่มีการชนของ side 115 ไม่ต้องใส่ plat2
    // - นับแบบ stage-pair เพื่อไม่ให้นับซ้ำ
    // helper ใช้ footprint edges (ติดกันจาก bounds) แบบเดียวกับด้านล่างในไฟล์


    function detectDirBetween(stageA, stageB) {
        const aTop = stageA.row;
        const aLeft = stageA.col;
        const aBottom = stageA.row + stageA.h - 1;
        const aRight = stageA.col + stageA.w - 1;

        const bTop = stageB.row;
        const bLeft = stageB.col;
        const bBottom = stageB.row + stageB.h - 1;
        const bRight = stageB.col + stageB.w - 1;

        if (bRight + 1 === aLeft) {
            const overlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop) + 1);
            if (overlap > 0) return 'left';
        }
        if (aRight + 1 === bLeft) {
            const overlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop) + 1);
            if (overlap > 0) return 'right';
        }
        if (bBottom + 1 === aTop) {
            const overlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft) + 1);
            if (overlap > 0) return 'top';
        }
        if (aBottom + 1 === bTop) {
            const overlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft) + 1);
            if (overlap > 0) return 'bottom';
        }
        return null;
    }

    // คืนค่า plat2 กลับเป็นแบบเดิม (ไม่ได้คำนวณ plat2 จาก side 115 เพิ่ม)
    // (เวอร์ชันก่อนหน้านี้ใช้ plat2 จาก vertex collisions เป็นหลัก)


    // Plat1 (มุมที่ไม่ชน) ยังคำนวณแบบเดิมจาก stageHasNeighborOnSide115
    const counted115SideCenters = new Set();

    function sideCenterKey(stage, dir) {
        const xBy2 = (stage.col * 2) + (dir === 'left' ? 0 : dir === 'right' ? stage.w * 2 : stage.w);
        const yBy2 = (stage.row * 2) + (dir === 'top' ? 0 : dir === 'bottom' ? stage.h * 2 : stage.h);
        return `${xBy2},${yBy2}`;
    }

    function addMiddlePlateFor115Side(stage, dir) {
        if (!stageHasNeighborOnSide115(stage, dir)) {
            plat1 += 1;
            return;
        }

        const key = sideCenterKey(stage, dir);
        if (counted115SideCenters.has(key)) return;

        counted115SideCenters.add(key);
        plat2 += 1;
    }

    // For each 115cm side center: open side = Plat 1, touching side = Plat 2.
    // Shared touching centers are counted once, even though both stages see the same joint.
    placedStages.forEach(s => {
        if (s.data.width !== 115) return;

        const isHorizontal = (s.w === 2 && s.h === 1);
        const isVertical = (s.w === 1 && s.h === 2);
        if (!isHorizontal && !isVertical) return;

        if (isHorizontal) {
            addMiddlePlateFor115Side(s, 'top');
            addMiddlePlateFor115Side(s, 'bottom');
        }
        if (isVertical) {
            addMiddlePlateFor115Side(s, 'left');
            addMiddlePlateFor115Side(s, 'right');
        }
    });








    // Auto-update accessory inputs if layout has changed
    if (updateAccessoryQty) {
        const p1QtySpan = document.querySelector('#acc-plat1 .qty');
        const p2QtySpan = document.querySelector('#acc-plat2 .qty');
        const p3QtySpan = document.querySelector('#acc-plat3 .qty');
        const p4QtySpan = document.querySelector('#acc-plat4 .qty');
        if (p1QtySpan) p1QtySpan.textContent = plat1;
        if (p2QtySpan) p2QtySpan.textContent = plat2;
        if (p3QtySpan) p3QtySpan.textContent = plat3;
        if (p4QtySpan) p4QtySpan.textContent = plat4;
    }

    // Screw warning logic (แก้): นับแบบ stage-pair เพื่อไม่ให้นับการชนซ้ำหลาย cell-edge
    // กติกา:
    // - 115*60 ชนด้าน 115 => 4
    // - 115*60 ชนด้าน 60  => 2
    // - 60*60 ชนกัน       => 2

    const cellIndexToStage = new Map();
    placedStages.forEach(stage => {
        stage.cells.forEach(idx => cellIndexToStage.set(idx, stage));
    });

    let requiredScrews = 0;

    function pairKey(aId, bId) {
        const minId = Math.min(aId, bId);
        const maxId = Math.max(aId, bId);
        return `${minId}|${maxId}`;
    }

    // ตรวจว่า stageA กับ stageB “ติดกัน” ฝั่งไหน (left/right/top/bottom) จากตำแหน่ง footprint บน grid
    // โดยให้ผลเป็น dir จากมุมมองของ A ไป B
    function detectDirFromAToB(stageA, stageB) {
        // A's bounds
        const aTop = stageA.row;
        const aLeft = stageA.col;
        const aBottom = stageA.row + stageA.h - 1;
        const aRight = stageA.col + stageA.w - 1;

        const bTop = stageB.row;
        const bLeft = stageB.col;
        const bBottom = stageB.row + stageB.h - 1;
        const bRight = stageB.col + stageB.w - 1;

        // left: B อยู่ติดซ้ายของ A
        if (bRight + 1 === aLeft) {
            // overlap แนวตั้ง
            const overlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop) + 1);
            if (overlap > 0) return 'left';
        }
        // right: B อยู่ติดขวาของ A
        if (aRight + 1 === bLeft) {
            const overlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(aTop, bTop) + 1);
            if (overlap > 0) return 'right';
        }
        // top: B อยู่ติดด้านบน A
        if (bBottom + 1 === aTop) {
            const overlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft) + 1);
            if (overlap > 0) return 'top';
        }
        // bottom: B อยู่ติดด้านล่าง A
        if (aBottom + 1 === bTop) {
            const overlap = Math.max(0, Math.min(aRight, bRight) - Math.max(aLeft, bLeft) + 1);
            if (overlap > 0) return 'bottom';
        }

        return null;
    }

    // classify screw count จากมุมมองของ stageA
    function screwsForConnection(stageA, dirFromAtoB) {
        if (stageA.data.width === 60) return 2;

        // stageA เป็น 115*60 (บน grid มี w/h ชี้ orientation จริง)
        // - แนวนอน (w=2,h=1): ด้าน 115 = top/bottom, ด้าน 60 = left/right
        // - แนวตั้ง (w=1,h=2): ด้าน 115 = left/right, ด้าน 60 = top/bottom
        const isHorizontal115 = (stageA.w === 2 && stageA.h === 1);
        const isVertical115 = (stageA.w === 1 && stageA.h === 2);

        const is115Side =
            (isHorizontal115 && (dirFromAtoB === 'top' || dirFromAtoB === 'bottom')) ||
            (isVertical115 && (dirFromAtoB === 'left' || dirFromAtoB === 'right'));

        return is115Side ? 4 : 2;
    }

    const visitedPairs = new Set();

    // สร้าง pair จากการดูการชนกันแบบติดกันของ bounds (พยายามนับแค่ครั้งเดียวต่อ pair)
    for (let i = 0; i < placedStages.length; i++) {
        for (let j = i + 1; j < placedStages.length; j++) {
            const stageA = placedStages[i];
            const stageB = placedStages[j];
            const key = pairKey(stageA.id, stageB.id);
            if (visitedPairs.has(key)) continue;

            // ถ้าติดกันจริง ให้ detect dir และนับ
            const dirAtoB = detectDirFromAToB(stageA, stageB);
            if (!dirAtoB) continue;

            visitedPairs.add(key);
            requiredScrews += screwsForConnection(stageA, dirAtoB);
        }
    }



    // Keep original stage counters for displaying warning text
    let stage115Count = 0;
    let stage60Count = 0;
    placedStages.forEach(stage => {
        if (stage.data.width === 115) stage115Count++;
        else if (stage.data.width === 60) stage60Count++;
    });

    // If user manually changed screws quantity, keep their value (do not overwrite)
    const screwQtySpan = document.querySelector('#acc-screw .qty');
    if (screwQtySpan) {
        if (!window.__userScrewQtyLocked) {
            screwQtySpan.textContent = requiredScrews;
        }
    }

    // Generate warning HTML (ต้องแสดง Plat แม้ user ปรับสกรู+น็อตเอง)
    if (plat1 > 0 || plat2 > 0 || plat3 > 0 || plat4 > 0 || requiredScrews > 0) {
        let warningHtml = `
            <div class="warning-title">
                ⚠️ คำแนะนำอุปกรณ์เชื่อมต่อเวที
            </div>
            <div class="warning-list">
        `;
        if (plat1 > 0) {
            warningHtml += `
                <div class="warning-item">
                    <span class="warning-badge">Plat 1</span> 
                    มุมที่ไม่ชนกับใคร จำนวน <strong>${plat1}</strong> จุด (ต้องใช้ Plat 1 จำนวน <strong>${plat1}</strong> ชิ้น)
                </div>
            `;
        }
        if (plat2 > 0) {
            warningHtml += `
                <div class="warning-item">
                    <span class="warning-badge">Plat 2</span> 
                    มุมชนกัน 2 มุม จำนวน <strong>${plat2}</strong> จุด (ต้องใช้ Plat 2 จำนวน <strong>${plat2}</strong> ชิ้น)
                </div>
            `;
        }
        if (plat3 > 0) {
            warningHtml += `
                <div class="warning-item">
                    <span class="warning-badge">Plat 3</span> 
                    มุมชนกัน 3 มุม (หรือชนกันเป็นรูปตัว L) จำนวน <strong>${plat3}</strong> จุด (ต้องใช้ Plat 3 จำนวน <strong>${plat3}</strong> ชิ้น)
                </div>
            `;
        }
        if (plat4 > 0) {
            warningHtml += `
                <div class="warning-item">
                    <span class="warning-badge">Plat 4</span> 
                    มุมชนกัน 4 มุม จำนวน <strong>${plat4}</strong> จุด (ต้องใช้ Plat 4 จำนวน <strong>${plat4}</strong> ชิ้น)
                </div>
            `;
        }
        if (requiredScrews > 0) {
            warningHtml += `
                <div class="warning-item">
                    <span class="warning-badge" style="background:#059669;color:white;">Screw + Connector</span> 
                    เวที 115cm จำนวน <strong>${stage115Count}</strong> ตัว, เวที 60cm จำนวน <strong>${stage60Count}</strong> ตัว (ต้องใช้ Screw+Connector <strong>${requiredScrews}</strong> ชุด)
                </div>
            `;
        }
        warningHtml += `</div>`;
        warningContainer.innerHTML = warningHtml;
        warningContainer.style.display = 'block';
    } else {
        warningContainer.innerHTML = '';
        warningContainer.style.display = 'none';
    }
}

function calculateTotal(layoutChanged = false) {
    // Update warnings and sync accessory counts if needed
    updateCornerWarnings(layoutChanged);

    const usageListEl = document.getElementById('stage-usage-list');
    const usageTotalEl = document.getElementById('stage-usage-total-count');
    if (usageListEl) {
        const stageUsage = new Map();

        placedStages.forEach(stage => {
            const width = stage.data.width || 0;
            const depth = stage.data.depth || 60;
            const height = stage.data.height || 0;
            const key = `${width} × ${depth} × ${height} cm`;
            stageUsage.set(key, (stageUsage.get(key) || 0) + 1);
        });

        if (stageUsage.size === 0) {
            usageListEl.innerHTML = '<div class="stage-usage-empty">ยังไม่ได้วางเวที</div>';
        } else {
            usageListEl.innerHTML = Array.from(stageUsage.entries())
                .sort(([a], [b]) => a.localeCompare(b, 'th'))
                .map(([size, count]) => `
                    <div class="stage-usage-row">
                        <span>${size}</span>
                        <span class="stage-usage-count">${count} ตัว</span>
                    </div>
                `)
                .join('');
        }
    }
    if (usageTotalEl) usageTotalEl.textContent = placedStages.length.toLocaleString('th-TH');

    let liteTotal = placedStages.reduce((sum, stage) => sum + (stage.priceLite || stage.data.priceLite || 0), 0);
    let proTotal = placedStages.reduce((sum, stage) => sum + (stage.pricePro || stage.data.pricePro || stage.data.priceLite || 0), 0);
    let accessoryTotal = 0;

    document.querySelectorAll('.accessory').forEach(acc => {
        const qty = parseInt(acc.querySelector('.qty').textContent) || 0;
        accessoryTotal += qty * parseInt(acc.dataset.price);
    });

    liteTotal += accessoryTotal;
    proTotal += accessoryTotal;

    const liteTotalEl = document.getElementById('total-lite-amount');
    const proTotalEl = document.getElementById('total-pro-amount');
    if (liteTotalEl) liteTotalEl.textContent = liteTotal.toLocaleString('th-TH') + " บาท";
    if (proTotalEl) proTotalEl.textContent = proTotal.toLocaleString('th-TH') + " บาท";

    // Calculate set bounding size with correct 115 orientation mapping.
    // Mapping requirement:
    // - If a 115 stage is placed horizontal: width += 115, depth += 60
    // - If a 115 stage is placed vertical:   width += 60,  depth += 115
    // - 60 stage always: width += 60, depth += 60 (no orientation in footprint; treated as 1x1 cell)
    //
    // NOTE: This app uses grid footprint (cells). We compute real cm bounds by treating each stage's
    // real size contribution in X/Y according to its orientation on the grid.

    // grid mapping: 1 cell step along X/Y = 60cm (60x60 stage = 1 cell)
    const CELL_STEP_CM = 60;

    function getStageRealSizeCm(stage) {


        // Convert stage footprint to real cm bounds using the stage's own orientation.
        // We treat stage.origin in grid-cell coordinates and then map its actual width/depth (cm)
        // based on orientation.
        if (stage.data.width === 115) {
            if (stage.orientation === 'horizontal') {
                return { wCm: 115, hCm: 60, gridWCells: 2, gridHCels: 1 };
            }
            return { wCm: 60, hCm: 115, gridWCells: 1, gridHCels: 2 };
        }
        return { wCm: 60, hCm: 60, gridWCells: 1, gridHCels: 1 };
    }

    // --- คำนวณความกว้าง/ความลึกแบบเดียวกับโค้ดอ้างอิงที่คุณให้มา ---
    // แนวคิด:
    // - แยกนับตาม “แนว row” เพื่อหา max ความกว้างของเซ็ต
    // - แยกนับตาม “แนว col” เพื่อหา max ความลึกของเซ็ต
    // - นับความยาวจริงที่เพิ่มขึ้นตาม “ขนาดจริงของเวทีแต่ละแผ่น” (115 หรือ 60)

    const CELL_INDEXES = gridSize; // ใช้ขนาดกริดเดียวกัน

    // จำนวนเซลล์ที่ใช้คำนวณ: 
    // - เรามองว่า stage origin (st.row/st.col) เป็นตำแหน่งเริ่มของการนับ
    // - stage 115 orientation จะกระทบเฉพาะแกนที่เป็น w/h จริง
    const rowWidths = new Array(CELL_INDEXES).fill(0);
    const colDepths = new Array(CELL_INDEXES).fill(0);

    placedStages.forEach(stage => {
        // stage.origin บนกริด
        const r = stage.row;
        const c = stage.col;

        const { wCm, hCm } = getStageRealSizeCm(stage);

        // ความกว้าง: ใช้แกน X (wCm) ลงใน row bucket
        // ความลึก: ใช้แกน Y (hCm) ลงใน col bucket
        if (rowWidths[r] !== undefined) rowWidths[r] += wCm;
        if (colDepths[c] !== undefined) colDepths[c] += hCm;
    });

    let totalWidthCm = placedStages.length > 0 ? Math.max(...rowWidths) : 0;
    let totalDepthCm = placedStages.length > 0 ? Math.max(...colDepths) : 0;



    const areaM2 = (totalWidthCm * totalDepthCm) / 10000;

    const wEl = document.getElementById('stage-width-cm');
    const dEl = document.getElementById('stage-depth-cm');
    const aEl = document.getElementById('stage-area-m2');

    if (wEl) wEl.textContent = totalWidthCm.toFixed(0);
    if (dEl) dEl.textContent = totalDepthCm.toFixed(0);
    if (aEl) aEl.textContent = areaM2.toFixed(2);
}



function clearGrid() {
    if (confirm("ล้างการจัดวางทั้งหมดใช่หรือไม่?")) {
        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.classList.remove('occupied');
            cell.style.border = '';
            cell.style.boxShadow = '';
            cell.style.backgroundColor = '';
            cell.textContent = '';
        });
        document.querySelectorAll('.stage-overlay').forEach(el => el.remove());
        placedStages = [];
        calculateTotal(true);
    }
}

// Initialize
window.onload = () => {
    createGrid();
    setupRotateButton();
    setupTapPlacementCancel();

    const draggable = document.getElementById('active-stage-draggable');
    if (draggable) {
        draggable.addEventListener('dragstart', dragStart);
        draggable.addEventListener('dragend', dragEnd);
        draggable.addEventListener('click', selectActiveStageForTap);
        draggable.addEventListener('pointerdown', (e) => {
            const data = getActiveStageData();
            if (data) beginPointerDrag(e, data);
        });
    }

    const selector = document.getElementById('stage-selector');
    if (selector) {
        selector.addEventListener('change', (e) => {
            const data = JSON.parse(e.target.value);
            draggable.dataset.width = data.width;
            draggable.dataset.depth = data.depth;
            draggable.dataset.height = data.height;
            draggable.dataset.lite = data.lite;
            draggable.dataset.pro = data.pro;

            document.getElementById('active-stage-name').textContent = data.name;
            document.getElementById('active-stage-lite').textContent = `Lite ${data.lite.toLocaleString()}`;
            document.getElementById('active-stage-pro').textContent = `Plus ${data.pro.toLocaleString()}`;

            if (currentDragData && currentDragData.isTapPlacement) {
                currentDragData = {
                    width: data.width,
                    height: data.height,
                    priceLite: data.lite,
                    pricePro: data.pro,
                    isTapPlacement: true
                };
            }
        });
    }

    const trashBin = document.getElementById('trash-bin');
    if (trashBin) {
        trashBin.addEventListener('dragover', e => {
            e.preventDefault();
            trashBin.style.background = '#fca5a5';
        });
        trashBin.addEventListener('dragleave', e => {
            trashBin.style.background = '#fef2f2';
        });
        trashBin.addEventListener('drop', e => {
            e.preventDefault();
            trashBin.style.background = '#fef2f2';
            clearDragHighlights();
            hideDragPreview();
            if (currentDragData && currentDragData.isExisting) {
                removeStage(currentDragData.stageId);
                currentDragData = null;
                calculateTotal(true);
            }
        });
    }

    calculateTotal(true);
};
