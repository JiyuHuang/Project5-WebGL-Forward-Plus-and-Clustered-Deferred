import TextureBuffer from './textureBuffer';
import { NUM_LIGHTS  } from '../scene';
import { vec4 } from 'gl-matrix';

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, Math.floor(NUM_LIGHTS / 4) + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          const i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    const frustumUnitHeight = Math.tan(camera.fov * (Math.PI / 180) / 2) * 2;
    const frustumUnitWidth = camera.aspect * frustumUnitHeight;
    const gridLenZ = (camera.far - camera.near) / this._zSlices;

    for (let lightIdx = 0; lightIdx < scene.lights.length; lightIdx += 1) {
      const light = scene.lights[lightIdx];
      const lightWorldPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1);
      let lightCameraSpacePos = vec4.create();
      vec4.transformMat4(lightCameraSpacePos, lightWorldPos, viewMatrix);
      lightCameraSpacePos[2] *= -1;

      const frustumHeight = frustumUnitHeight * lightCameraSpacePos[2];
      const frustumWidth = frustumUnitWidth * lightCameraSpacePos[2];
      const frustumXMin = -frustumWidth / 2;
      const frustumYMin = -frustumHeight / 2;
      const gridLenX = frustumWidth / this._xSlices;
      const gridLenY = frustumHeight / this._ySlices;

      let xBegin = Math.floor((lightCameraSpacePos[0] - light.radius - frustumXMin) / gridLenX);
      let xEnd = Math.floor((lightCameraSpacePos[0] + light.radius - frustumXMin) / gridLenX);
      let yBegin = Math.floor((lightCameraSpacePos[1] - light.radius - frustumYMin) / gridLenY);
      let yEnd = Math.floor((lightCameraSpacePos[1] + light.radius - frustumYMin) / gridLenY);
      let zBegin = Math.floor((lightCameraSpacePos[2] - light.radius - camera.near) / gridLenZ);
      let zEnd = Math.floor((lightCameraSpacePos[2] + light.radius - camera.near) / gridLenZ);

      xBegin = Math.max(xBegin, 0);
      xEnd = Math.min(xEnd, this._xSlices - 1);
      yBegin = Math.max(yBegin, 0);
      yEnd = Math.min(yEnd, this._ySlices - 1);
      zBegin = Math.max(zBegin, 0);
      zEnd = Math.min(zEnd, this._zSlices - 1);

      for (let z = zBegin; z <= zEnd; z += 1) {
        for (let y = yBegin; y <= yEnd; y += 1) {
          for (let x = xBegin; x <= zEnd; x += 1) {
            const gridIdx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let bufferIdx = this._clusterTexture.bufferIndex(gridIdx, 0);
            const numLights = this._clusterTexture.buffer[bufferIdx] += 1;
            bufferIdx = this._clusterTexture.bufferIndex(gridIdx, Math.floor(numLights / 4)) + numLights % 4;
            this._clusterTexture.buffer[bufferIdx] = lightIdx;
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}