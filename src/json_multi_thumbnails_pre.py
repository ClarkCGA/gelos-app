import pandas as pd
import ast
from shapely import wkt
import json
import s3fs

# read csv
chips_df = pd.read_csv("data/chip_metadata.csv")

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
    "title" : "Visualization of Embeddings",
    "xaxis_title" : "t-SNE Dimension 1",
    "yaxis_title" : "t-SNE Dimension 2",
}
# convert to json
title_js = json.dumps(config["title"])
xaxis_js = json.dumps(config["xaxis_title"])
yaxis_js = json.dumps(config["yaxis_title"])

# set land_cover(str) for categorical data for plotting
chips_df["land_cover"] = chips_df["land_cover"].astype(str)
# add latitude and longitude
chips_df["latitude"] = chips_df["centroid"].apply(get_lat)
chips_df["longitude"] = chips_df["centroid"].apply(get_lon)

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
chips_df['Land Cover'] = chips_df['land_cover'].map(land_cover)

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

# set prefix
s3_url="https://gelos-fm.s3.amazonaws.com/thumbnails"

def gen_thumbnail_urls(row,  s3_prefix, image):
    '''
    Generate S3 urls for thumbnails
    :param row: dictionary with chip_index and dates
    :param s3_prefix: S3 url prefix 
    :param image: st, e.g., "landsat"
    :return urls: a list of urls
    '''
    dates = row[f"{image}_dates"]
    
    # check if dates are str
    if isinstance(dates, str):
        dates = ast.literal_eval(dates)

    chip_idx = row['chip_index']

    urls = []
    for i, d in enumerate(dates):
        urls.append(f"{s3_prefix}/{image}_{chip_idx:06}_{i}_{d}.png")

    return urls

for image in ["landsat", "sentinel_1", "sentinel_2"]:
    chips_df[f"{image}_urls"] = chips_df.apply(
        gen_thumbnail_urls, axis=1, s3_prefix=s3_url, image=image
    )

for image in ["landsat", "sentinel_1", "sentinel_2"]:
    chips_df[f"{image}_dates_list"] = chips_df[f"{image}_dates"].apply(ast.literal_eval)

# build a list of points dictionary
points = (
    chips_df
    .rename(columns={
        "cls_dim1": "x",
        "cls_dim2": "y",
        "Land Cover": "category"
    })[["x","y","category","sentinel_1_dates_list","sentinel_2_dates_list","landsat_dates_list"]]
    .assign(
        id = chips_df["chip_index"], 
        lat = chips_df["latitude"],
        lon = chips_df["longitude"],
        color=chips_df["Land Cover"].map(color_dict_label),
        icon= chips_df["Land Cover"].map(icon_dict_label),
        landsat_thumbs = chips_df["landsat_urls"],
        sentinel_1_thumbs = chips_df["sentinel_1_urls"],
        sentinel_2_thumbs = chips_df["sentinel_2_urls"],
        )
    .to_dict(orient="records")
)

# write it to jason
with open("data/points.json","w") as f:
    json.dump(points, f)