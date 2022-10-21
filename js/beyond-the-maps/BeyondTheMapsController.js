/* Beyond The Edges of The Maps specific UI interaction logic */

function BeyondTheMaps() {}

BeyondTheMaps.Status = {
	WaitingForLandPoint: "WaitingForLandPoint"
};

BeyondTheMaps.Controller = class {
	constructor(gameContainer, isMobile) {
		this.actuator = new BeyondTheMaps.Actuator(gameContainer, isMobile, isAnimationsOn());

		this.resetGameManager();
		this.resetNotationBuilder();
		this.resetGameNotation();

		showReplayControls();
	}

	getGameTypeId() {
		return GameType.BeyondTheMaps.id;
	}

	resetGameManager() {
		this.theGame = new BeyondTheMaps.GameManager(this.actuator);
	}

	resetNotationBuilder() {
		/* Purposely using Trifle game notation as it is generic and json */
		this.notationBuilder = new Trifle.NotationBuilder();
		this.notationBuilder.moveData = {};
		this.notationBuilder.moveData.phases = [];
		this.notationBuilder.phaseIndex = -1;
	}

	resetNotationBuilderPhase() {
		this.notationBuilder.moveData.phases.pop();
		this.notationBuilder.phaseIndex--;
		this.notationBuilder.status = BRAND_NEW;
	}

	beginNewMovePhase() {
		this.notationBuilder.phaseIndex++;
		this.notationBuilder.moveData.phases[this.notationBuilder.phaseIndex] = {};
	}
	getCurrentMovePhase() {
		return this.notationBuilder.moveData.phases[this.notationBuilder.phaseIndex];
	}

	resetGameNotation() {
		this.gameNotation = this.getNewGameNotation();
	}

	completeSetup() {
		// Nothing
	}

	getNewGameNotation() {
		/* Purposely using Trifle game notation as it is generic and json */
		return new Trifle.GameNotation();
	}

	static getHostTilesContainerDivs() {
		return '';
	}

	static getGuestTilesContainerDivs() {
		return '';
	}

	callActuate() {
		this.theGame.actuate();
	}

	resetMove() {
		if (this.notationBuilder.status === BRAND_NEW) {
			// Remove last move
			this.gameNotation.removeLastMove();
		}

		rerunAll();
	}

	getDefaultHelpMessageText() {
		return "<h4>Beyond The Edges of The Maps</h4> <p>A game from the world of Aerwiar.</p>";
	}

	getAdditionalMessage() {
		var msg = "";

		if (this.gameNotation.moves.length === 0) {
			if (onlinePlayEnabled && gameId < 0 && userIsLoggedIn()) {
				msg += "Click <em>Join Game</em> above to join another player's game. Or, you can start a game that other players can join by making a move. <br />";
			} else {
				msg += "Sign in to enable online gameplay. Or, start playing a local game by making a move. <br />";
			}

			msg += getGameOptionsMessageHtml(GameType.BeyondTheMaps.gameOptions);
		} else {
			// 
		}

		return msg;
	}

	gamePreferenceSet(preferenceKey) {
		// 
	}

	startOnlineGame() {
		createGameIfThatIsOk(this.getGameTypeId());
	}

	canExploreSea() {
		var canExploreSea = true;
		if (this.notationBuilder.moveData.phases.length > 0) {
			this.notationBuilder.moveData.phases.forEach(phaseData => {
				if (phaseData.moveType === BeyondTheMaps.MoveType.EXPLORE_SEA) {
					canExploreSea = false;
				}
			});
		}
		return canExploreSea;
	}
	canExploreLand() {
		var canExploreLand = true;
		if (this.notationBuilder.moveData.phases.length > 0) {
			this.notationBuilder.moveData.phases.forEach(phaseData => {
				if (phaseData.moveType === BeyondTheMaps.MoveType.EXPLORE_LAND) {
					canExploreLand = false;
				}
			});
		}
		return canExploreLand;
	}

	unplayedTileClicked(tileDiv) {
		// Nothing to do
	}

	pointClicked(htmlPoint) {
		this.theGame.markingManager.clearMarkings();
		this.callActuate();

		if (this.theGame.getWinner() || !myTurn() || currentMoveIndex !== this.gameNotation.moves.length
				|| (playingOnlineGame() && !iAmPlayerInCurrentOnlineGame())) {
			return;
		}

		var npText = htmlPoint.getAttribute("name");

		var notationPoint = new NotationPoint(npText);
		var rowCol = notationPoint.rowAndColumn;
		var boardPoint = this.theGame.board.cells[rowCol.row][rowCol.col];

		if (this.notationBuilder.status === BRAND_NEW) {
			if (boardPoint.hasTile()) {
				if (boardPoint.tile.ownerName !== getCurrentPlayer()) {
					debug("That's not your tile!");
					return;
				}
				
				if (boardPoint.tile.tileType === BeyondTheMaps.TileType.SHIP
						&& this.canExploreSea()) {
					this.notationBuilder.status = WAITING_FOR_ENDPOINT;
					this.beginNewMovePhase();
					this.getCurrentMovePhase().moveType = BeyondTheMaps.MoveType.EXPLORE_SEA;
					this.notationBuilder.player = this.getCurrentPlayer();
					this.notationBuilder.currentPlayer = this.getCurrentPlayer();
					this.getCurrentMovePhase().startPoint = new NotationPoint(htmlPoint.getAttribute("name"));

					//	Deciding distance?
					var moveDistance = 6;

					this.theGame.revealPossibleMovePoints(boardPoint, false, moveDistance);
					refreshMessage();
				} else if (boardPoint.tile.tileType === BeyondTheMaps.TileType.LAND
						&& this.canExploreLand()) {
					this.notationBuilder.status = WAITING_FOR_ENDPOINT; //BeyondTheMaps.Status.WaitingForLandPoint;	// Only if land possible?

					this.beginNewMovePhase();
					this.getCurrentMovePhase().moveType = BeyondTheMaps.MoveType.EXPLORE_LAND;
					this.notationBuilder.player = this.getCurrentPlayer();
					this.notationBuilder.currentPlayer = this.getCurrentPlayer();

					this.theGame.revealPossibleExploreLandPoints(this.getCurrentPlayer());

					refreshMessage();
				}
			}
		} else if (this.notationBuilder.status === WAITING_FOR_ENDPOINT) {
			if (boardPoint.isType(POSSIBLE_MOVE) 
					&& this.getCurrentMovePhase().moveType === BeyondTheMaps.MoveType.EXPLORE_SEA) {
				// They're trying to move their Ship there! And they can! Exciting!
				this.getCurrentMovePhase().endPoint = new NotationPoint(htmlPoint.getAttribute("name"));
				var possiblePaths = boardPoint.possibleMovementPaths;
				this.theGame.hidePossibleMovePoints();

				var move = this.gameNotation.getNotationMoveFromBuilder(this.notationBuilder);
				this.theGame.runNotationMove(move, this.notationBuilder.phaseIndex, false, true);

				var landPointsPossible = this.theGame.markPossibleLandPointsForMovement(boardPoint, possiblePaths, this.notationBuilder.player);

				if (landPointsPossible.length > 1) {
					// Land points are marked on the board as Possible points now
					this.notationBuilder.status = WAITING_FOR_BONUS_ENDPOINT;
				} else {
					if (landPointsPossible.length > 0) {
						this.getCurrentMovePhase().landPoint = new NotationPoint(landPointsPossible[0].getNotationPointString());
						this.theGame.board.placeLandPiecesForPlayer(this.getCurrentPlayer(), [this.getCurrentMovePhase().landPoint]);
					}
					this.theGame.hidePossibleMovePoints();
					this.completeMovePhase();
				}
			} else if (boardPoint.isType(POSSIBLE_MOVE) 
					&& this.getCurrentMovePhase().moveType === BeyondTheMaps.MoveType.EXPLORE_LAND) {
				// Adding land woo!
				this.theGame.hidePossibleMovePoints();
				if (!this.getCurrentMovePhase().landPoints) {
					this.getCurrentMovePhase().landPoints = [];
				}
				this.getCurrentMovePhase().landPoints.push(new NotationPoint(htmlPoint.getAttribute("name")));

				var move = this.gameNotation.getNotationMoveFromBuilder(this.notationBuilder);
				this.theGame.runNotationMove(move, this.notationBuilder.phaseIndex, false, true);

				// Deciding number?
				var exploreLandNumber = 3;

				if (this.getCurrentMovePhase().landPoints.length < exploreLandNumber) {
					// More!
					var landIsPossible = this.theGame.revealPossibleContinueExploreLandPoints(this.getCurrentPlayer(), boardPoint);
					if (!landIsPossible) {
						this.completeMovePhase();
					}
				} else {
					this.completeMovePhase();
				}
			}
			// else {
			// 	this.theGame.hidePossibleMovePoints();
			// 	this.resetNotationBuilderPhase();
			// }
		} else if (this.notationBuilder.status === WAITING_FOR_BONUS_ENDPOINT) {
			if (boardPoint.isType(POSSIBLE_MOVE)) {
				this.getCurrentMovePhase().landPoint = new NotationPoint(htmlPoint.getAttribute("name"));
				
				this.theGame.board.placeLandPiecesForPlayer(this.getCurrentPlayer(), [this.getCurrentMovePhase().landPoint]);
				this.theGame.hidePossibleMovePoints();
				
				this.completeMovePhase();
			}
		}
	}

	completeMove() {
		var move = this.gameNotation.getNotationMoveFromBuilder(this.notationBuilder);

		// Move all set. Add it to the notation!
		this.gameNotation.addMove(move);

		if (playingOnlineGame()) {
			callSubmitMove();
		} else {
			finalizeMove();
		}
	}

	completeMovePhase() {
		// var move = this.gameNotation.getNotationMoveFromBuilder(this.notationBuilder);
		var moveIsComplete = this.notationBuilder.moveData.phases.length >= 2;

		this.notationBuilder.status = BRAND_NEW;

		if (moveIsComplete) {
			this.completeMove();
		} else {
			// Run this phase so far -- Controller interaction already has done it
			// this.theGame.runNotationMove(move, this.notationBuilder.phaseIndex, false, true);
		}
	}

	getTileMessage(tileDiv) {
		var divName = tileDiv.getAttribute("name");	// Like: GW5 or HL
		var tileId = parseInt(tileDiv.getAttribute("id"));

		var tile = new BeyondTheMaps.Tile(null, divName.substring(1), divName.charAt(0));

		var message = [];

		var ownerName = HOST;
		if (divName.startsWith('G')) {
			ownerName = GUEST;
		}

		var tileCode = divName.substring(1);

		var heading = PlaygroundTile.getTileName(tileCode);

		message.push(tile.ownerName + "'s tile");

		return {
			heading: heading,
			message: message
		}
	}

	getPointMessage(htmlPoint) {
		var npText = htmlPoint.getAttribute("name");

		var notationPoint = new NotationPoint(npText);
		var rowCol = notationPoint.rowAndColumn;
		var boardPoint = this.theGame.board.cells[rowCol.row][rowCol.col];

		var heading;
		var message = [];
		if (boardPoint.hasTile()) {
			heading = boardPoint.tile.getName();
		}

		return {
			heading: heading,
			message: message
		}
	}

	playAiTurn(finalizeMove) {
		// 
	}

	startAiGame(finalizeMove) {
		// 
	}

	getAiList() {
		return [];
	}

	getCurrentPlayer() {
		if (this.gameNotation.moves.length % 2 === 0) {
			return HOST;
		} else {
			return GUEST;
		}
	}

	cleanup() {
		// Nothing.
	}

	isSolitaire() {
		return false;
	}

	setGameNotation(newGameNotation) {
		this.gameNotation.setNotationText(newGameNotation);
	}

	getSkipToIndex(currentMoveIndex) {
		for (var i = currentMoveIndex; i < this.gameNotation.moves.length; i++) {
			if (this.gameNotation.moves[i].moveType === PlaygroundMoveType.hideTileLibraries) {
				return i;
			}
		}
		return currentMoveIndex;
	}

	setAnimationsOn(isAnimationsOn) {
		this.actuator.setAnimationOn(isAnimationsOn);
	}

	runMove(move, withActuate, moveAnimationBeginStep, skipAnimation) {
		if (withActuate && !skipAnimation) {
			var numPhases = move.moveData.phases.length;
			var phaseIndex = 0;
			this.theGame.runNotationMove(move, phaseIndex, withActuate);
			phaseIndex++;
			if (numPhases > phaseIndex) {
				debug("MORE THAN ONE PHASE");
				var phaseInterval = setTimeout(() => {
					this.theGame.runNotationMove(move, phaseIndex, withActuate);
					phaseIndex++;
					if (phaseIndex >= numPhases) {
						clearInterval(phaseInterval);
					}
				}, replayIntervalLength / numPhases);
			}
		} else {
			for (var phaseIndex = 0; phaseIndex < move.moveData.phases.length; phaseIndex++) {
				this.theGame.runNotationMove(move, phaseIndex, withActuate);
			}
		}
	}

	cleanup() {
		// Nothing
	}

	RmbDown(htmlPoint) {
		var npText = htmlPoint.getAttribute("name");

		var notationPoint = new NotationPoint(npText);
		var rowCol = notationPoint.rowAndColumn;
		this.mouseStartPoint = this.theGame.board.cells[rowCol.row][rowCol.col];
	}

	RmbUp(htmlPoint) {
		var npText = htmlPoint.getAttribute("name");

		var notationPoint = new NotationPoint(npText);
		var rowCol = notationPoint.rowAndColumn;
		var mouseEndPoint = this.theGame.board.cells[rowCol.row][rowCol.col];

		if (mouseEndPoint == this.mouseStartPoint) {
			this.theGame.markingManager.toggleMarkedPoint(mouseEndPoint);
		}
		else if (this.mouseStartPoint) {
			this.theGame.markingManager.toggleMarkedArrow(this.mouseStartPoint, mouseEndPoint);
		}
		this.mouseStartPoint = null;

		this.callActuate();
	}

};
