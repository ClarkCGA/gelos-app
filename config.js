window.MA_CONFIG = {
  BASE_DATA_URL: 'https://gelos-fm.s3.amazonaws.com/json/points.json',

  DEFAULT_MODEL: 'exp001_prithvi300_cls_token_layer_23_tsne',

  DEFAULT_THUMBDATASET: 'sentinel_2',

  DEFAULT_MODE: 'globe',

  MODEL_FIELDS: {
  "exp001_prithvi300_cls_token_layer_23_tsne": {
    path: "https://gelos-fm.s3.amazonaws.com/json/exp001_prithvi300_cls_token_layer_23_tsne.json",
    title: "Prithvi EO V2 300M: CLS Token"
  },
  "exp001_prithvi300_all_steps_of_middle_patch_layer_23_tsne": {
    path: "https://gelos-fm.s3.amazonaws.com/json/exp001_prithvi300_all_steps_of_middle_patch_layer_23_tsne.json",
    title: "Prithvi EO V2 300M: All Steps of Middle Patch"
  },
  "exp001_prithvi300_all_patches_from_april_to_june_layer_23_tsne": {
    path: "https://gelos-fm.s3.amazonaws.com/json/exp001_prithvi300_all_patches_from_april_to_june_layer_23_tsne.json",
    title: "Prithvi EO V2 300M: All Patches from April to June"
  },
  "exp004_prithvi600_cls_token_layer_31_tsne": {
    path: "https://gelos-fm.s3.amazonaws.com/json/exp004_prithvi600_cls_token_layer_31_tsne.json",
    title: "Prithvi EO V2 600M: CLS Token"
  },
  "exp004_prithvi600_all_steps_of_middle_patch_layer_31_tsne": {
    path: "https://gelos-fm.s3.amazonaws.com/json/exp004_prithvi600_all_steps_of_middle_patch_layer_31_tsne.json",
    title: "Prithvi EO V2 600M: All Steps of Middle Patch"
  },
  "exp004_prithvi600_all_patches_from_april_to_june_layer_31_tsne": {
    path: "https://gelos-fm.s3.amazonaws.com/json/exp004_prithvi600_all_patches_from_april_to_june_layer_31_tsne.json",
    title: "Prithvi EO V2 600M: All Patches from April to June"
  },
  "exp007_terramind_all_steps_of_middle_patch_layer_11_tsne": {
    path: "https://gelos-fm.s3.amazonaws.com/json/exp007_terramind_all_steps_of_middle_patch_layer_11_tsne.json",
    title: "Terramind V1 Base: All Steps of Middle Patch"
  },
  "exp007_terramind_all_patches_from_april_to_june_layer_11_tsne": {
    path: "https://gelos-fm.s3.amazonaws.com/json/exp007_terramind_all_patches_from_april_to_june_layer_11_tsne.json",
    title: "Terramind V1 Base: All Patches from April to June"
  },
  "exp007_terramind_all_embeddings_layer_11_tsne": {
    path: "https://gelos-fm.s3.amazonaws.com/json/exp007_terramind_all_embeddings_layer_11_tsne.json",
    title: "Terramind V1 Base: All Embeddings"
  }},

  IMAGE_DATASETS: {
    sentinel_1: { label: 'Sentinel-1' },
    sentinel_2: { label: 'Sentinel-2' },
    landsat:    { label: 'Landsat' }
  },

};