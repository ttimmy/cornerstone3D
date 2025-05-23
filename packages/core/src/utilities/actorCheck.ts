import type { Types } from '..';

type actorTypes = 'vtkActor' | 'vtkVolume' | 'vtkImageSlice';

/**
 * Checks if a vtk Actor is an image actor (vtkVolume or vtkImageSlice) otherwise returns false.
 *
 * @param actor - actor
 * @returns A boolean value.
 */
export function isImageActor(actorEntry: Types.ActorEntry): boolean {
  return (
    actorIsA(actorEntry, 'vtkVolume') || actorIsA(actorEntry, 'vtkImageSlice')
  );
}

export function actorIsA(
  actorEntry: Types.ActorEntry | Types.Actor,
  actorType: actorTypes
): boolean {
  const actorToCheck = 'isA' in actorEntry ? actorEntry : actorEntry.actor;
  if (!actorToCheck) {
    return false;
  }
  // @ts-expect-error
  return !!actorToCheck.isA(actorType);
}
