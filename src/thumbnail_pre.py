import pandas as pd
import numpy as np
from PIL import Image
import ast
import s3fs
from rasterio.io import MemoryFile
import os

# read csv
chips_df = pd.read_csv("../data/embeddings_df_v0.11_test.csv")

# set anonymous S3FileSystem to read files from public bucket 
s3 = s3fs.S3FileSystem(anon=True)

## helper function
def gen_chip_urls(row,  s3_prefix):
    '''
    Generate S3 urls for chips
    :param row: dictionary with chip_id and dates
    :param s3_prefix: S3 url prefix 
    :return s3_urls: a list of urls
    '''
    s3_urls = []
    dates = ast.literal_eval(row["dates"])
    for date in dates:
        filename = f"s2_{row['chip_id']:06}_{date}.tif"
        s3_url = f"{s3_prefix}/{filename}"
        s3_urls.append(s3_url)
    return s3_urls

def mask_nodata(band, nodata_values=(-999,)):
    '''
    Mask nodata to nan
    :param band
    :param nodata_values:nodata values in chips is -999
    :return band
    '''
    band = band.astype(float)
    for val in nodata_values:
        band[band == val] = np.nan
    return band

def normalize(band):
    '''
    Normalize a band to 0-1 range(float)
    :param band (ndarray)
    return normalize band (ndarray); when max equals min, returns zeros.
    '''
    if np.nanmean(band) >= 4000:
        band = band / 6000
    else:
        band = band / 4000
    band = np.clip(band, None, 1)

    return band

def create_thumbnail(url, output_dir):
    '''
    Read S3 file into memory, create and save a resized png thumbnail.
    :param url: S3 file URL
    :param output_dir: directory to save thumbnails
    :return: saved file path (str) or "" if failed
    '''
    try:
        os.makedirs(output_dir, exist_ok=True)

        # read raw bytes from s3 file
        with s3.open(url, "rb") as f:
            data = f.read()

        # wrap the raw bytes into an memory file
        with MemoryFile(data) as memfile:
            
            # read memory file with rasterio
            with memfile.open() as src:
                # mask nodata to have correct calculate normalization
                # band1->blue, band2->green, band3->red

                blue = src.read(1).astype(float)
                green = src.read(2).astype(float)
                red = src.read(3).astype(float)

                blue = normalize(mask_nodata(blue))
                green = normalize(mask_nodata(green))
                red = normalize(mask_nodata(red))

                # stack in RGB
                rgb = np.dstack((red, green, blue))

                # convert float(0-1) to uint8 (0-255)
                rgb_8bit = (rgb * 255).astype(np.uint8)

                # convert to png in memory
                pil_img = Image.fromarray(rgb_8bit)
                
                # save png to local
                filename = os.path.basename(url).replace(".tif", ".png")
                file_path = os.path.join(output_dir, filename)
                pil_img.save(file_path, format="PNG")

                return file_path

    except Exception as e:
        # return an empty string for Exception
        return ""
    
# set prefix
s3_prefix="s3://gfm-bench"

# generate S3 file URLs 
chips_df["urls"] = chips_df.apply(lambda row: gen_chip_urls(row, s3_prefix), axis=1)

# create thumbnail 
chips_df["thumbs"] = chips_df["urls"].apply(
    lambda urls: [create_thumbnail(p, output_dir="../data/thumbnails") for p in urls]
)