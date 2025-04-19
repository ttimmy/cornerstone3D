import type { IRenderingEngine, ViewportInput } from 'core/src/types';
import { mock } from 'jest-mock-extended';
let mockRenderingEngine = mock<IRenderingEngine>();
jest.mock('../../src/RenderingEngine/renderingEngineCache', () => ({
  get: () => mockRenderingEngine
}));
import StackViewport from '../../src/RenderingEngine/StackViewport';
import ViewportType from '../../src/enums/ViewportType';
import vtkRenderer from '@kitware/vtk.js/Rendering/Core/Renderer';
import type vtkCamera from '@kitware/vtk.js/Rendering/Core/Camera';

fdescribe('StackViewport', () => {

  const props: ViewportInput = {
    id: 'viewport',
    renderingEngineId: 'renderingEngine',
    type: ViewportType.STACK,
    element: mock<HTMLDivElement>(),
    sx: 0,
    sy: 100,
    sWidth: 100,
    sHeight: 100,
    defaultOptions: {

    },
    canvas: mock<HTMLCanvasElement>()
  };

  const mockCamera = mock<vtkCamera>();
  mockCamera.getViewUp.mockReturnValue([0, 1, 0]);
  mockCamera.getViewPlaneNormal.mockReturnValue([0, 0, -1]);
  mockCamera.getPosition.mockReturnValue([0, 0, 1]);
  mockCamera.getFocalPoint.mockReturnValue([0, 0, 0]);

  const mockRenderer = mock<vtkRenderer>();
  mockRenderer.getActiveCamera.mockReturnValue(mockCamera);
  mockRenderer.computeVisiblePropBounds.mockReturnValue([0, 1, 0, 1, 0, 1]);

  mockRenderingEngine = mock<IRenderingEngine>();
  mockRenderingEngine.hasBeenDestroyed = false;
  mockRenderingEngine.offscreenMultiRenderWindow = {
    getRenderer: jest.fn().mockReturnValue(mockRenderer)
  };

  it('should create a StackViewport instance', () => {
    const stackViewport = new StackViewport(props);
    expect(stackViewport).toBeInstanceOf(StackViewport);
  });
});
