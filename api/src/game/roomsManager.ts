import SocketIO from 'socket.io';
import { generate } from 'shortid';
import { Player, buildPlayer, reshapePlayer } from '../player';
import { GameState } from '../game';
import { buildGameRoom } from './gameManager';
import { io } from '../main';

const buildRoomsManager = () => {
    let roomId: string | null = null;
    let idlePlayers: Player[] = [];
    let gameLauncher: NodeJS.Timeout;
    let launchDate: number | null = null;

    const joinIdleRoom = (socket: SocketIO.Socket, nickname: string) => {
        if (!roomId) {
            roomId = generate();
        }

        idlePlayers.push(buildPlayer(socket, nickname));
        socket.join(roomId);

        if (launchDate) {
            socket.emit('gameState', { gameState: GameState.AboutToLock, nextState: launchDate })
        } else {
            socket.emit('gameState', { gameState: GameState.WaitingForPlayers });
        }

        io.to(roomId).emit('players', {
            players: idlePlayers.map(reshapePlayer)
        });

        checkRoomState();
    };

    const checkRoomState = () => {
        if (!roomId) return;

        if (idlePlayers.length === 5) {
            launchDate = Date.now() + 10000;
            io.to(roomId).emit('gameState', {
                gameState: GameState.AboutToLock,
                nextState: launchDate
            });
            gameLauncher = setTimeout(launchGame, 10000);
        }

        if (idlePlayers.length === 50) {
            launchGame();
        }
    };

    const launchGame = () => {
        if (!roomId) return;

        if (gameLauncher) {
            clearTimeout(gameLauncher);
        }

        const room = buildGameRoom({ roomId, idlePlayers });
        room.prepareGame();
        idlePlayers = [];
        roomId = null;
        launchDate = null;
    };

    return { joinIdleRoom };
};

export const roomsManager = buildRoomsManager();