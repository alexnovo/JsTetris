﻿var sounds = [];

var N = 20; // количество строк
var M = 10; // количество столбцов
var cellWidth, cellHeight;
var board;
var boardPosX, boardPosY, boardWidth, boardHeight, infoPanelWidth;
var gameState;
var nextFigure = new Figure();
var currentFigure = nextFigure;
var myTimer = 0; // счетчик миллисекунд
var lastMove = myTimer; // для ограничения перемещений фигуры
var lastDownMove = myTimer; // для ограничений падения
var speed = 1.0; // скорость спуска фигуры (ячеек / в секунду)
var MAX_SPEED = 30;
var showFps = true;
var score = 0;
var bestScore = 0;

var MOVE = { LEFT: 1, RIGHT: 2, DOWN: 3, MOVE: 4, DROP: 5 };
var nextMove = 0;
var myCanvas = document.getElementById("myCanvas");
var drawContext = myCanvas.getContext('2d');

function resizeCanvas() {
    myCanvas.width = window.innerWidth;
    myCanvas.height = window.innerHeight;
    cellWidth = cellHeight = Math.floor(Math.min(myCanvas.width / M, (myCanvas.height) / (N + 2)));
    drawContext.font = cellWidth.toString() + 'px Arial';
    boardPosX = (myCanvas.width - cellWidth * M) / 2;
    boardPosY = cellHeight * 2;
    boardWidth = cellWidth * M;
    boardHeight = cellHeight * N;
    infoPanelWidth = boardWidth;
}
var GAME_STATE = { MENU: 0, PLAY: 1, GAME_OVER: 2 };
function loadPage() {
    resizeCanvas();

    initAudio();
    initGame();

    setInterval(doStep, 1000 / (2 * MAX_SPEED));
    setInterval(draw, 1000 / 30); // 30 fps
}
function initGame() {
    storage = window.localStorage;
    bestScore = storage['bestScore'] || 0;

    resources.load(["img/blocks.png","img/tetris.png","img/rem.png","img/bg.png"]);

    var i, j;
    board = new Array(N);
    for (i = 0; i < N; ++i) {
        board[i] = new Array(M);
        for (j = 0; j < M; ++j)
            board[i][j] = 0;
    }
    // добавим "рамку" чтоб не проверять граничные условия
    for (i = 0; i < N; ++i)
        board[i][0] = board[i][M - 1] = 1;
    for (j = 0; j < M; ++j)
        board[N - 1][j] = 1;
    nextFigure = new Figure();
    currentFigure = nextFigure;
    myTimer = new Date().getTime();
    lastMove = myTimer;
    lastDownMove = myTimer;
    speed = 1.0;
    score = 0;
    nextMove = 0;

    gameState = GAME_STATE.MENU;
}

function doStep() {
    if (gameState != GAME_STATE.PLAY)
        return;
    var isTryDown = false;   // была попытка подвинуть вниз
    var isMovedDown = false; // был сдвиг вниз
    myTimer = new Date().getTime();
    if (myTimer - lastMove >= 1000 / MAX_SPEED && nextMove != 0) // команды пользователя
    {
        switch (nextMove) {
            case MOVE.LEFT:
                tryMove(currentFigure, 0, -1);
                break;
            case MOVE.RIGHT:
                tryMove(currentFigure, 0, 1);
                break;
            case MOVE.DOWN:
                if (tryMove(currentFigure, 1, 0)) {
                    isMovedDown = true;
                    lastDownMove = myTimer;
                }
                isTryDown = true;
                break;
            case MOVE.ROTATE:
                if (!tryTurn(currentFigure)) {
                    temp = new Figure();
                    copyFigure(temp, currentFigure)
                    if (temp.j < M-2) {
                        if (tryMove(temp, 0, 1) && tryTurn(temp))
                            copyFigure(currentFigure, temp);
                    }
                    if (temp.j > 0) {
                        if (tryMove(temp, 0, -1) && tryTurn(temp))
                            copyFigure(currentFigure, temp);
                    }
                }
                break;
            case MOVE.DROP:
                while (tryMove(currentFigure, 1, 0));
                putDown();
                break;
        }
        lastMove = myTimer;
        nextMove = 0;
    }
    if (myTimer - lastDownMove >= 1000 / speed) // падение
    {
        if (tryMove(currentFigure, 1, 0)) {
            isMovedDown = true;
            lastDownMove = myTimer;
        }
        isTryDown = true;
    }
    if (isTryDown && !isMovedDown) {
        putDown();
    }
}
function putDown() { // положить фигура
    playSound('drop');
    // "положить" фигуру на поле
    var i, j;
    for (i = 0; i < 3; ++i)
        for (j = 0; j < 3; ++j) {
            if (currentFigure.data[i][j] != 0)
                board[currentFigure.i + i][currentFigure.j + j] = currentFigure.data[i][j];
        }
    currentFigure = nextFigure;
    nextFigure = new Figure();
    if (checkOverlap(currentFigure)) {
        gameState = GAME_STATE.GAME_OVER;
    }
    checkFilled();
}

function ClearAnimInfo(row_)
{
    this.row = row_;
    this.cnt = 10; // счетчик/таймер анимации
}
var clearAnimateTime = 0;
var clearingRows = [];
function checkFilled() {
    var cnt = 0;
    var isNeedPlayClearSound = false;
    for (var i = N - 2; i > 1; i--) {
        var isFullLine = true;
        var isEmptyLine = true;
        for (var j = 1; j < M - 1; ++j) {
            if (board[i][j] == 0)
                isFullLine = false;
            else
                isEmptyLine = false;
        }
        if (isEmptyLine)
            break;
        if (isFullLine) {
            var isPresent = false;
            for (var k = 0; k < clearingRows.length; k++)
                if (clearingRows[k].row == i) // строка уже есть в списке удаляемых(анимируемых)
                    isPresent = true;
            if (!isPresent) {
                for(var j=1;j<M-1;j++)
                    board[i][j]=0;
                clearingRows.push(new ClearAnimInfo(i));
                isNeedPlayClearSound = true;
            }
        }
    }
    if (isNeedPlayClearSound)
        playSound('clear');
}
function animateRemoval()
{
    var clearedCount = 0;
    var i = 0;
    while (i < clearingRows.length) {
        if (clearingRows[i].cnt > 0) {
            var frameIdx = 10 - clearingRows[i].cnt;
            for(var k = 1; k < M-1; k++) {
                drawContext.drawImage(resources.get('img/rem.png'),
                    frameIdx * 64, 0, 64, 64,
                    boardPosX+k*cellWidth, boardPosY + clearingRows[i].row * cellHeight,
                    cellWidth, cellHeight);
            }
            clearingRows[i].cnt--;
            i++;
        } else {
            //удаление строки
            var k;
            for (k = clearingRows[i].row; k > 0; --k)
                board[k] = board[k - 1].slice();
            for (k = i + 1; k < clearingRows.length; ++k)
                clearingRows[k].row++;
            clearingRows.splice(i, 1);
            clearedCount++;
        }
    }
    if (clearedCount > 2)
        score += 2000;
    if (clearedCount > 1)
        score += 500;
    if (clearedCount == 1)
        score += 100;
}

function checkOverlap(figure) {
    var i, j;
    for (i = 0; i < 3; ++i)
        for (j = 0; j < 3; ++j) {
            if (figure.data[i][j] != 0 && board[figure.i + i][figure.j + j] != 0)
                return true;
        }
    return false;
}

function tryMove(figure, di, dj) {
    var movedFigure = new Figure();
    copyFigure(movedFigure, figure);
    movedFigure.i += di;
    movedFigure.j += dj;
    if (checkOverlap(movedFigure) == false) {
        //playSound('move');
        figure.i = movedFigure.i;
        figure.j = movedFigure.j;
        return true;
    }
    return false;
}

function tryTurn(figure) {
    if (figure.code == FIGURE_CODE.CUBE)
        return false;
    var turnedFigure = new Figure();
    copyFigure(turnedFigure, figure);
    var i, j;
    for (i = 0; i < 3; ++i)
        for (j = 0; j < 3; ++j)
            turnedFigure.data[i][j] = figure.data[2 - j][i];
    if (checkOverlap(turnedFigure) == false) {
        for (i = 0; i < 3; ++i)
            for (j = 0; j < 3; ++j)
                figure.data[i][j] = turnedFigure.data[i][j];
        return true;
    }
    return false;
}

function drawBlock(idx, x, y) {
    var BLOCK_SIZE = 64;
    var i = Math.floor( idx / 8 );
    var j = idx % 8;
    drawContext.drawImage(resources.get('img/blocks.png'),
        j * BLOCK_SIZE, i * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE,
        x, y, cellWidth, cellHeight);
}

function drawBoard() {
    // blocks
    var i, j;
    //for (i = 0; i < 2; i++)
    //    for (j = 0; j < M; j++)
    //        drawBlock(1,
    //            boardPosX + j * cellHeight,
    //            i * cellWidth, cellWidth, cellHeight);
    for (i = 0; i < N; ++i) {
        for (j = 0; j < M; ++j) {
            //if (board[i][j] != 0)
                drawBlock(board[i][j],
                    boardPosX + j * cellHeight,
                    boardPosY + i * cellWidth, cellWidth, cellHeight);
        }
    }
}

var lastLoop = new Date().getTime();
function drawInfo() {
    var info = "";
    if (showFps) {
        var thisLoop = new Date().getTime();
        var fps = 1000 / (thisLoop - lastLoop);
        lastLoop = thisLoop;
        info = fps.toFixed(1) + ' fps ';
    }
    //drawContext.lineWidth = 5;
    drawContext.fillStyle = "#ffffff";
    roundRect(drawContext,
        boardPosX + boardWidth + cellWidth, boardPosY + cellHeight,
        infoPanelWidth - 2 * cellWidth, 2 * cellHeight, cellWidth / 2, true, false);
    var d = 5;
    roundRect(drawContext,
        boardPosX + boardWidth + cellWidth + d, boardPosY + cellHeight + d,
        infoPanelWidth - 2 * cellWidth - 2 * d, 2 * cellHeight - 2 * d, cellWidth / 2 - d, false, true);
    drawContext.textAlign = "center";
    drawContext.fillText("SCORE", boardPosX + boardWidth + infoPanelWidth / 2, boardPosY + cellHeight);
    drawContext.fillStyle = "#000000";
    drawContext.fillText( score, boardPosX + boardWidth + infoPanelWidth / 2, boardPosY + 2 * cellHeight);
}

function drawFigure(figure, x, y) {
    if (arguments.length < 3 ) {
        x = boardPosX + figure.j * cellWidth;
        y = boardPosY + figure.i * cellHeight;
    }
    else {
        BLOCK_SIZE = 64;
        drawContext.drawImage(resources.get('img/blocks.png'),
            0, 0, BLOCK_SIZE, BLOCK_SIZE,
            x, y, 3 * cellWidth, 3* cellHeight);
    }
    var i, j;
    for (i = 0; i < 3; ++i) {
        for (j = 0; j < 3; ++j) {
            if (figure.data[i][j] != 0)
                drawBlock(figure.data[i][j],
                    x + j * cellHeight,
                    y + i * cellWidth, cellWidth, cellHeight);
        }
    }
}

function draw() {
    drawContext.fillStyle = "#343629";
    drawContext.fillRect(0, 0, myCanvas.width, myCanvas.height);
    drawContext.drawImage(resources.get('img/bg.png'),
        boardPosX + boardWidth, boardPosY + 2 * cellHeight, 10 * cellWidth, 5 * cellHeight);
    drawBoard();
    switch (gameState) {
        case GAME_STATE.MENU:
            {
                drawContext.fillStyle = "#ffffff";
                drawContext.textAlign = "center";
                drawContext.fillText("Press to start.", myCanvas.width / 2, myCanvas.height / 2);
            } break;
        case GAME_STATE.PLAY:
            {
                drawFigure(currentFigure);
                if (clearingRows.length > 0)
                    animateRemoval();
            } break;
        case GAME_STATE.GAME_OVER:
            {
                drawContext.fillStyle = "#ffffff";
                drawContext.textAlign = "center";
                var str = "You result: " + score;
                drawContext.fillText(str, myCanvas.width / 2, myCanvas.height / 2);
                var str = "Record: " + bestScore;
                drawContext.fillText(str, myCanvas.width / 2, myCanvas.height / 2+30);
                if (score > bestScore)
                    storage['bestScore'] = bestScore = score;
            } break;
    }
    drawFigure(nextFigure, boardPosX + boardWidth + cellWidth, boardPosY + boardHeight - 4 * cellHeight);
    drawInfo();
}
var KEY = { UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, ENTER: 13, SPACE: 32 };
function keyDown() {
    switch (gameState) {
        case GAME_STATE.MENU:
            {
                gameState = GAME_STATE.PLAY;
                nextFigure = new Figure();
            } break;
        case GAME_STATE.PLAY:
            {
                switch (event.keyCode) {
                    case KEY.UP:
                        nextMove = MOVE.ROTATE;
                        break;
                    case KEY.DOWN:
                        nextMove = MOVE.DOWN;
                        break;
                    case KEY.LEFT:
                        nextMove = MOVE.LEFT;
                        break;
                    case KEY.RIGHT:
                        nextMove = MOVE.RIGHT;
                        break;
                    case KEY.SPACE:
                        nextMove = MOVE.DROP;
                        break;
                }
            } break;
        case GAME_STATE.GAME_OVER:
            {
                initGame();
                gameState = GAME_STATE.MENU;
            } break;
    }
}
var MB_LEFT = 1;
function mouseDown() {
    //if (event.button == MB_LEFT)
    nextMove = MOVE.ROTATE;
}