#! /usr/bin/env ruby

require 'json'
require 'algoliasearch'
require 'open-uri'

if ARGV.length != 3
  $stderr << "usage: push.rb APPLICATION_ID API_KEY INDEX\n"
  exit 1
end

def price_range(price)
  if price < 50
    "1 - 50"
  elsif price < 100
    "101 - 200"
  elsif price < 500
    "201 - 500"
  elsif price < 2000
    "501 - 2000"
  elsif price < 5000
    "2001 - 5000"
  else
    "> 5000"
  end
end

products = JSON.parse File.read('data.json')
brands = products.group_by { |p| p['manufacturer'] }.map { |k, v| { :name => k, :count => v.size } }.select { |r| r[:name] }
categories = products.group_by { |p| p['category'] }.map { |k, v| { :name => k, :count => v.size } }.select { |r| r[:name] }

Algolia.init :application_id => ARGV[0], :api_key => ARGV[1]

index = Algolia::Index.new(ARGV[2])
index.set_settings :attributesToIndex => ["name", "manufacturer", "unordered(shortDescription)", "category"],
  :customRanking => ["asc(bestSellingRank)"],
  :attributesForFaceting => ["category", "salePrice", "manufacturer", "shipping", "type", "customerReviewCount", "salePrice_range"],
  :slaves => ["#{ARGV[2]}_price_desc", "#{ARGV[2]}_price_asc"]
index.clear_index! rescue 'not fatal'
res = index.add_objects products
index.wait_task res['taskID']

Algolia::Index.new("#{ARGV[2]}_price_desc").set_settings :attributesToIndex => ["name", "manufacturer", "unordered(shortDescription)", "category"],
  :customRanking => ["asc(bestSellingRank)"],
  :attributesForFaceting => ["category", "salePrice", "manufacturer", "shipping", "type", "customerReviewCount", "salePrice_range"],
  :ranking => ["desc(salePrice)", "typo", "geo", "words", "proximity", "attribute", "exact", "custom"]

Algolia::Index.new("#{ARGV[2]}_price_asc").set_settings :attributesToIndex => ["name", "manufacturer", "unordered(shortDescription)", "category"],
  :customRanking => ["asc(bestSellingRank)"],
  :attributesForFaceting => ["category", "salePrice", "manufacturer", "shipping", "type", "customerReviewCount", "salePrice_range"],
  :ranking => ["asc(salePrice)", "typo", "geo", "words", "proximity", "attribute", "exact", "custom"]

index = Algolia::Index.new("#{ARGV[2]}_manufacturers")
index.set_settings :attributesToIndex => ['name'], :customRanking => ['desc(count)']
index.add_objects brands

index = Algolia::Index.new("#{ARGV[2]}_categories")
index.set_settings :attributesToIndex => ['name'], :customRanking => ['desc(count)']
index.add_objects categories