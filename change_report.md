# Change Report: Selected-Point Highlight on the Scatter Plot

**File changed:** `script.js`
**Date:** 2026-11-10

## The problem

When you clicked a point on the map, the matching point on the scatter plot was hard to find.
The plot uses Plotly's WebGL scatter type (`scattergl`), which ignores `marker.line` (outlines)
in the `selected` style. So the black outline in the code was never drawn, and the selected
point only grew from size 5 to 9.

## What changed

### 1. A red ring with a white halo on every selected point

Each ring is a **halo** (hollow marker, 3px white outline) with a **ring** on top
(same marker, 1.5px red outline, `#ff1744`). Five extra layers are added to the plot:

| Position in plot data | Layer | Used for |
|---|---|---|
| `0`, `1` | multi halo, multi ring | Box, Lasso, map polygon (2+ points) |
| `2 … N+1` | land-cover point layers | all points |
| `N+2`, `N+3` | single halo, single ring | one selected point |
| `N+4` | copy of the selected point | one selected point |

(`N` = number of land-cover point layers; the first layer is drawn at the bottom.)

- **Multi-selection:** rings are drawn **under** all points, so dense clusters stay readable and
  each point keeps its own colour.
- **Single selection:** the ring is drawn **above** all other points and **just below** the
  selected point (a copy of the point, in its own colour, is drawn on top). Neighbouring points
  can no longer cover it.
- Mouse hover and clicks ignore these layers (`hoverinfo: 'skip'`), and they are not in the legend.
- Style constants, declared near `let scatterTraces = [];`:

  | Constant | Value | Meaning |
  |---|---|---|
  | `SEL_MARKER_COLOR` | `#ff1744` | ring colour |
  | `SEL_MARKER_RADIUS_PX` | 6 | ring radius, single selection |
  | `SEL_MARKER_MULTI_RADIUS_PX` | 6 | ring radius, multi-selection |
  | `SEL_HALO_WIDTH_PX` | 3 | white halo width |
  | `SEL_RING_WIDTH_PX` | 1.5 | red ring width |
  | `SEL_POINT_SIZE_PX` | 10 | size of the selected-point copy |
  | `RING_TRACE_COUNT` | 2 | number of multi layers before the point layers |

### 2. Select and unselect functions

| Function | What it does |
|---|---|
| `makeRingTraces(radiusPx, prefix)` | Builds an empty halo + ring pair (`'multi'` or `'single'`). |
| `makeSinglePointTrace()` | Builds the empty layer for the copy of the single selected point. |
| `plotData()` | Returns all layers in the order above. `Plotly.newPlot` and `Plotly.react` use it. |
| `showPlotRings(ids)` | **Select:** one point → fills the single layers (ring + point copy in the point's colour); 2+ points → fills the multi layers. Updates all five layers in one redraw. Points in a class hidden by the legend filter get no ring. |
| `showPlotSelectionMarker(id)` | Single-point shortcut for `showPlotRings([id])`. |
| `clearPlotSelectionMarker()` | **Unselect:** empties all five selection layers (single and multi). |
| `getPlotLoc(id)` | Finds a point's position on the plot whether the id is a number or a string. |

### 3. Every kind of selection gets rings

All selection paths already ran through `applySelectionToPlot()`, so that function now calls
`showPlotRings()`:

- clicking a point on the map
- clicking a point on the plot
- Box Select or Lasso Select on the plot
- the polygon draw tool on the map
- re-applying the selection after switching model, strategy or map style

Clearing a selection or changing the legend filter removes the rings.

### 4. Point styling only touches the land-cover point layers

Calls that fade or select points used to change every layer on the plot. That would now include
the ring layers, which would fade or break them. Those calls now pass `catTraceIdx()` so they only
change the land-cover point layers.

Because the two ring layers come first in the plot data, land-cover layer `i` is now at position
`i + RING_TRACE_COUNT` (`RING_TRACE_COUNT = 2`). Every place that refers to a land-cover layer by
position adds this offset: `catTraceIdx()`, `clearPlotSelections`, `selectOnPlotById`, the legend
filter's show/hide call, and the visibility check in `showPlotRings`. `ringTraceIdx()` returns
`[0, 1]` (multi layers) and `singleTraceIdx()` returns `[N+2, N+3, N+4]` (single layers).

### 5. Other small changes

- The selected point is size 10. The outline setting that never worked is removed, with a
  comment explaining why.
- Unselected points fade to 10% opacity, so the selection stands out.
- The style constants listed in section 1 are declared together above the first `Plotly.newPlot` call. This fixed the
  error "Cannot access 'SEL_MARKER_RADIUS_PX' before initialization".

### 6. Why multi-select rings are under the points and the single ring is on top

In the first version the ring layers were drawn on top of the points, and every ring was 22 px
across, about 4× the size of a point. That was fine for one point. With Box or Lasso Select,
hundreds of points packed close together each got a big ring, the rings overlapped, and their
white and red outlines covered the points' own colours. Multi-select rings are now drawn
underneath and made smaller (6 px radius, thinner lines).

Drawing the single ring underneath too made it hard to see, because neighbouring points covered
the small ring. So a single selection now has its own layers above all other points, with a copy
of the selected point drawn on top of its ring.

## Limits

- The map highlights at most 2,000 selected points, so that is also the most rings shown.
- Only a syntax check (`node --check script.js`) was run; behaviour needs checking in the browser.

## Commit message summary

```
Highlight selected points on the scatter plot with a red ring + white halo

- scattergl ignores marker.line in `selected`, so selected points were barely
  visible. Add halo + ring scattergl traces:
  - multi-select: placed before the category traces (drawn under the points)
  - single select: placed after the category traces, with a copy of the
    selected point on top, so the ring sits just below the selected point
- Separate radii: SEL_MARKER_RADIUS_PX (single), SEL_MARKER_MULTI_RADIUS_PX
  (multi); 3 px halo, 1.5 px ring.
- Category trace i is now gd.data[i + RING_TRACE_COUNT]; all index-based
  restyles use this offset.
- New helpers: makeRingTraces, makeSinglePointTrace, plotData, showPlotRings,
  clearPlotSelectionMarker, getPlotLoc, catTraceIdx, ringTraceIdx, singleTraceIdx.
- Rings appear for single and multi-selection (map click, plot click,
  Box/Lasso select, map polygon tool) via applySelectionToPlot; cleared on
  deselect and legend-filter change; hidden classes get no ring.
- Restyle calls now target category traces only (catTraceIdx) so the ring
  overlay is not dimmed.
- Non-selected points dim to 0.1 opacity.
```
