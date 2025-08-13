import pandas as pd
import ast
from shapely import wkt
import json
import s3fs

# read csv
chips_df = pd.read_csv("data/embeddings_df_v0.11_test.csv")

# set anonymous S3FileSystem to read files from public bucket 
s3 = s3fs.S3FileSystem(anon=True)

def get_lat(geometry):
    lat = wkt.loads(geometry).coords.xy[1][0]
    return lat

def get_lon(geometry):
    lon = wkt.loads(geometry).coords.xy[0][0]
    return lon

## generate json
# title: plot title
# xaxis_title: x axis title
# yaxis_title: x axis title
config = {
    "title" : "Visualization of EO-FM-Bench Embeddings",
    "xaxis_title" : "t-SNE Dimension 1",
    "yaxis_title" : "t-SNE Dimension 2",
}
# convert to json
title_js = json.dumps(config["title"])
xaxis_js = json.dumps(config["xaxis_title"])
yaxis_js = json.dumps(config["yaxis_title"])

# set lc(str) for categorical data for plotting
chips_df["lc"] = chips_df["lc"].astype(str)
# add latitude and longitude
chips_df["latitude"] = chips_df["geometry"].apply(get_lat)
chips_df["longitude"] = chips_df["geometry"].apply(get_lon)

# color dictionary
color_dict = {
    '1': '#2c41e6',   # Water
    '2': '#04541b',   # Trees
    '5': '#99e0ad',   # Crops
    '7': '#797b85',   # Built area
    '8': '#a68647',   # Bare ground
    '11': '#f7980a',  # Rangeland
}

# land cover dictionary
land_cover = {
    '1': 'Water',
    '2': 'Trees',
    '5': 'Crops',
    '7': 'Built area',
    '8': 'Bare ground',
    '11': 'Rangeland'
}

# add the legend column
chips_df['Land Cover'] = chips_df['lc'].map(land_cover)

# color dictionary with label
color_dict_label = {
    'Water': '#3bb2d0',
    'Trees': '#44b964',
    'Crops': '#f1f075',
    'Built area': "#999999",
    'Bare ground': '#a236bf',
    'Rangeland': '#f472b6'
}

# icon dictionary with label
icon_dict_label = {
    'Water': 'mapbox-marker-icon-blue',
    'Trees': 'mapbox-marker-icon-green',
    'Crops': 'mapbox-marker-icon-yellow',
    'Built area': 'mapbox-marker-icon-gray',
    'Bare ground': 'mapbox-marker-icon-purple',
    'Rangeland': 'mapbox-marker-icon-pink'
}

# create dates Python list
chips_df["dates_list"] = chips_df["dates"].apply(ast.literal_eval)

# set prefix
s3_url="https://gfm-bench.s3.amazonaws.com/thumbnails"

# create thumb_urls column
chips_df["thumb_urls"] = chips_df.apply(
    lambda r: [
        f"{s3_url}/s2_{r.chip_id:06}_{date}.png"
        for date in r.dates_list
    ],
    axis=1
)

# build a list of points dictionary
points = (
    chips_df
    .rename(columns={
        "cls_dim1": "x",
        "cls_dim2": "y",
        "Land Cover": "category"
    })[["x","y","chip_id", "latitude", "longitude","category","dates_list"]]
    .assign(
        id = chips_df["chip_id"], 
        lat = chips_df["latitude"],
        lon = chips_df["longitude"],
        color=chips_df["Land Cover"].map(color_dict_label),
        icon= chips_df["Land Cover"].map(icon_dict_label),
        thumbs = chips_df["thumb_urls"])
    .to_dict(orient="records")
)

# write it to jason
with open("data/points.json","w") as f:
    json.dump(points, f)