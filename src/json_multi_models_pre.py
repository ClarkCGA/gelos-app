import pandas as pd
import numpy as np
import ast
from shapely import wkt
import json
import s3fs

# 1. Read base and model csvs

base_csv_path   = "data/cleaned_df.csv"                  # Prithvi (original)
#model2_path = "data/cleaned_df_attributes_model2_test.csv"     # Model 2
#model3_path = "data/cleaned_df_attributes_model3_test.csv"     # Model 3

chips_df = pd.read_csv(base_csv_path)

# strip accidental whitespace in headers 
chips_df.columns = chips_df.columns.str.strip()

# Read model2/model3 
# m2 = (
#     pd.read_csv(model2_path)
#       .rename(columns=str.strip)[['chip_id', 'cls_dim1', 'cls_dim2']]
#       .rename(columns={'cls_dim1': 'model2_x', 'cls_dim2': 'model2_y'})
# )

# m3 = (
#     pd.read_csv(model3_path)
#       .rename(columns=str.strip)[['chip_id', 'cls_dim1', 'cls_dim2']]
#       .rename(columns={'cls_dim1': 'model3_x', 'cls_dim2': 'model3_y'})
# )

# # Merge them into base on chip_id 
# chips_df = chips_df.merge(m2, on='chip_id', how='left')
# chips_df = chips_df.merge(m3, on='chip_id', how='left')

# Rename the base cls_dim1/cls_dim2 to prithvi_x/prithvi_y
chips_df = chips_df.rename(columns={'cls_dim1': 'prithvi_x', 'cls_dim2': 'prithvi_y'})


# 2. S3 + helpers

s3 = s3fs.S3FileSystem(anon=True)

def get_lat(geometry):
    lat = wkt.loads(geometry).coords.xy[1][0]
    return lat

def get_lon(geometry):
    lon = wkt.loads(geometry).coords.xy[0][0]
    return lon

config = {
    "title" : "Visualization of Embeddings",
    "xaxis_title" : "t-SNE Dimension 1",
    "yaxis_title" : "t-SNE Dimension 2",
}
title_js = json.dumps(config["title"])
xaxis_js = json.dumps(config["xaxis_title"])
yaxis_js = json.dumps(config["yaxis_title"])

# Land cover as string
chips_df["land_cover"] = chips_df["land_cover"].astype(str)

# lat/lon from centers
chips_df["latitude"]  = chips_df["y_center"]
chips_df["longitude"] = chips_df["x_center"]

# Color dictionaries
color_dict = {
    '1': '#2c41e6',   # Water
    '2': '#04541b',   # Trees
    '5': '#99e0ad',   # Crops
    '7': '#797b85',   # Built area
    '8': '#a68647',   # Bare ground
    '11': '#f7980a',  # Rangeland
}
land_cover = {
    '1': 'Water',
    '2': 'Trees',
    '5': 'Crops',
    '7': 'Built area',
    '8': 'Bare ground',
    '11': 'Rangeland'
}
chips_df['Land Cover'] = chips_df['land_cover'].map(land_cover)

color_dict_label = {
    'Water': '#419bdf',
    'Trees': '#397d49',
    'Crops': '#e49635',
    'Built area': "#c4281b",
    'Bare ground': '#a59b8f',
    'Rangeland': '#e3e2c3'
}

s3_url="https://gelos-fm.s3.amazonaws.com/thumbnails"

def gen_thumbnail_urls(row, s3_prefix, image):
    """
    Generate S3 urls for thumbnails
    :param row: dictionary with chip_id and dates
    :param s3_prefix: S3 url prefix 
    :param image: str, e.g., "landsat"
    :return urls: a list of urls
    """
    dates = row[f"{image}_dates"]
    if isinstance(dates, str):
        dates = ast.literal_eval(dates)

    chip_id = row['chip_id']
    return [
        f"{s3_prefix}/{image}_{chip_id:06}_{d}.png"
        for d in dates if d
    ]

for image in ["landsat", "sentinel_1", "sentinel_2"]:
    chips_df[f"{image}_urls"] = chips_df.apply(
        gen_thumbnail_urls, axis=1, s3_prefix=s3_url, image=image
    )

for image in ["landsat", "sentinel_1", "sentinel_2"]:
    chips_df[f"{image}_dates"] = chips_df[f"{image}_dates"].apply(ast.literal_eval)


# 3. create points dict

points_df = (
    chips_df
    .rename(columns={
        "Land Cover": "category"
    })[
        [
            "prithvi_x", "prithvi_y",
            # extra models:
            ##"model2_x", "model2_y",
            ##"model3_x", "model3_y",
            "category", "sentinel_1_dates", "sentinel_2_dates", "landsat_dates",         
        ]
    ]
    .assign(
        id  = chips_df["chip_id"],
        lat = chips_df["latitude"],
        lon = chips_df["longitude"],
        color = chips_df["Land Cover"].map(color_dict_label),
        landsat_thumbs = chips_df["landsat_urls"],
        sentinel_1_thumbs = chips_df["sentinel_1_urls"],
        sentinel_2_thumbs = chips_df["sentinel_2_urls"],
    )
    .replace({np.nan: None})
)

points = points_df.to_dict(orient="records")


# 4. write JSON

with open("data/points.json","w") as f:
    json.dump(points, f)