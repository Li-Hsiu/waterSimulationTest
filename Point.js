class Point{

    constructor(x, y, windX, windY, choppiness) {
        this.x = x;
        this.y = y;
        this.windX = windX;
        this.windY = windY;
        this.choppiness = choppiness;
    }

    getCoord() {
        return [this.x, this.y];
    }

    getWindVec2() {
        return [this.windX, this.windY];
    }

    getChoppiness() {
        return this.choppiness;
    }
}


export { Point }